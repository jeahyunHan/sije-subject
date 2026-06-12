import { Injectable } from '@nestjs/common';
import { OrderStatus as PrismaOrderStatus, Prisma } from '@prisma/client';
import { DomainErrorCode, DomainException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { ActorRole } from '../common/entities/actor-role.entity';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    if (createOrderDto.actorRole !== ActorRole.BUYER) {
      throw new DomainException(DomainErrorCode.ORDER_CREATE_FORBIDDEN);
    }

    const data = this.buildCreateData(createOrderDto);
    const orderNo = await this.generateOrderNo();

    try {
      return await this.prisma.order.create({
        data: {
          orderNo,
          ...data,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new DomainException(DomainErrorCode.ORDER_ALREADY_EXISTS, {
          orderNo,
        });
      }

      throw error;
    }
  }

  async confirm(orderNo: string, confirmOrderDto: ConfirmOrderDto) {
    const normalizedOrderNo = orderNo?.trim();
    const confirmedBy = confirmOrderDto.confirmedBy?.trim();

    if (!normalizedOrderNo) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND);
    }

    if (!confirmedBy || confirmOrderDto.actorRole !== ActorRole.SOURCING) {
      throw new DomainException(DomainErrorCode.ORDER_CONFIRM_FORBIDDEN);
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderNo: normalizedOrderNo },
      });

      if (!order) {
        throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND, {
          orderNo: normalizedOrderNo,
        });
      }

      if (order.status !== PrismaOrderStatus.PENDING) {
        throw new DomainException(
          DomainErrorCode.ORDER_CONFIRM_INVALID_STATUS,
          {
            orderNo: normalizedOrderNo,
            currentStatus: order.status,
          },
        );
      }

      const effectiveAt = new Date();
      const updatedOrder = await tx.order.update({
        where: { orderNo: normalizedOrderNo },
        data: {
          status: PrismaOrderStatus.CONFIRMED,
          version: 1,
        },
      });

      const history = await tx.history.create({
        data: {
          orderNo: updatedOrder.orderNo,
          requestId: null,
          version: updatedOrder.version,
          productName: updatedOrder.productName,
          quantity: updatedOrder.quantity,
          unitPrice: updatedOrder.unitPrice,
          specification: this.toInputJson(updatedOrder.specification),
          dueDate: updatedOrder.dueDate,
          status: updatedOrder.status,
          createdBy: updatedOrder.createdBy,
          changedFields: {
            status: {
              from: order.status,
              to: PrismaOrderStatus.CONFIRMED,
            },
          },
          approvedBy: confirmedBy,
          effectiveAt,
        },
      });

      return { order: updatedOrder, history };
    });
  }

  findAll() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orderNo: string) {
    const normalizedOrderNo = orderNo?.trim();

    if (!normalizedOrderNo) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND);
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: normalizedOrderNo },
    });

    if (!order) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND, {
        orderNo: normalizedOrderNo,
      });
    }

    return order;
  }

  findAllHistories() {
    return this.prisma.history.findMany({
      orderBy: [
        { effectiveAt: 'desc' },
        { createdAt: 'desc' },
        { orderNo: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async findHistories(orderNo: string) {
    const normalizedOrderNo = await this.ensureOrderExists(orderNo);

    return this.prisma.history.findMany({
      where: { orderNo: normalizedOrderNo },
      orderBy: { version: 'asc' },
    });
  }

  async findVersion(orderNo: string, version: string | number) {
    const normalizedOrderNo = await this.ensureOrderExists(orderNo);
    const parsedVersion = this.parseVersion(
      version,
      DomainErrorCode.ORDER_VERSION_NOT_FOUND,
    );
    const history = await this.prisma.history.findUnique({
      where: {
        orderNo_version: {
          orderNo: normalizedOrderNo,
          version: parsedVersion,
        },
      },
    });

    if (!history) {
      throw new DomainException(DomainErrorCode.ORDER_VERSION_NOT_FOUND, {
        orderNo: normalizedOrderNo,
        version: parsedVersion,
      });
    }

    return history;
  }

  async findAsOf(orderNo: string, at: string) {
    const normalizedOrderNo = await this.ensureOrderExists(orderNo);
    const effectiveAt = new Date(at);

    if (!at || Number.isNaN(effectiveAt.getTime())) {
      throw new DomainException(DomainErrorCode.ORDER_VERSION_AS_OF_NOT_FOUND, {
        orderNo: normalizedOrderNo,
        at,
      });
    }

    const history = await this.prisma.history.findFirst({
      where: {
        orderNo: normalizedOrderNo,
        effectiveAt: {
          lte: effectiveAt,
        },
      },
      orderBy: [{ effectiveAt: 'desc' }, { version: 'desc' }],
    });

    if (!history) {
      throw new DomainException(DomainErrorCode.ORDER_VERSION_AS_OF_NOT_FOUND, {
        orderNo: normalizedOrderNo,
        at,
      });
    }

    return history;
  }

  async compareVersions(
    orderNo: string,
    fromVersion: string | number,
    toVersion: string | number,
  ) {
    const normalizedOrderNo = await this.ensureOrderExists(orderNo);
    const parsedFromVersion = this.parseVersion(
      fromVersion,
      DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND,
    );
    const parsedToVersion = this.parseVersion(
      toVersion,
      DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND,
    );
    const histories = await this.prisma.history.findMany({
      where: {
        orderNo: normalizedOrderNo,
        version: {
          in: [parsedFromVersion, parsedToVersion],
        },
      },
    });
    const from = histories.find(
      (history) => history.version === parsedFromVersion,
    );
    const to = histories.find((history) => history.version === parsedToVersion);

    if (!from || !to) {
      throw new DomainException(
        DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND,
        {
          orderNo: normalizedOrderNo,
          fromVersion: parsedFromVersion,
          toVersion: parsedToVersion,
          foundVersions: histories.map((history) => history.version),
        },
      );
    }

    return {
      orderNo: normalizedOrderNo,
      fromVersion: parsedFromVersion,
      toVersion: parsedToVersion,
      differences: this.buildVersionDifferences(from, to),
    };
  }

  private buildCreateData(createOrderDto: CreateOrderDto) {
    const productName = createOrderDto.productName?.trim();
    const createdBy = createOrderDto.createdBy?.trim();
    const dueDate = new Date(createOrderDto.dueDate);
    const status = createOrderDto.status ?? OrderStatus.DRAFT;

    if (
      !productName ||
      !createdBy ||
      !Number.isInteger(createOrderDto.quantity) ||
      createOrderDto.quantity <= 0 ||
      !Number.isFinite(createOrderDto.unitPrice) ||
      createOrderDto.unitPrice <= 0 ||
      !this.isPlainObject(createOrderDto.specification) ||
      !this.hasOnlyAllowedSpecificationFields(createOrderDto.specification) ||
      !this.isNonEmptyString(createOrderDto.specification.color) ||
      !this.isNonEmptyString(createOrderDto.specification.size) ||
      Number.isNaN(dueDate.getTime()) ||
      ![OrderStatus.DRAFT, OrderStatus.PENDING].includes(status)
    ) {
      throw new DomainException(DomainErrorCode.ORDER_CREATE_INVALID_PAYLOAD);
    }

    return {
      productName,
      quantity: createOrderDto.quantity,
      unitPrice: createOrderDto.unitPrice,
      specification: this.buildSpecification(createOrderDto.specification),
      dueDate,
      status: status as PrismaOrderStatus,
      version: 0,
      createdBy,
    };
  }

  private async generateOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const latestOrder = await this.prisma.order.findFirst({
      where: {
        orderNo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNo: 'desc',
      },
      select: {
        orderNo: true,
      },
    });
    const nextSequence =
      this.parseOrderNoSequence(latestOrder?.orderNo, prefix) + 1;

    return `${prefix}${String(nextSequence).padStart(6, '0')}`;
  }

  private parseOrderNoSequence(orderNo: string | undefined, prefix: string) {
    if (!orderNo?.startsWith(prefix)) {
      return 0;
    }

    const sequence = Number(orderNo.slice(prefix.length));

    if (!Number.isInteger(sequence) || sequence < 0) {
      return 0;
    }

    return sequence;
  }

  private buildSpecification(specification: CreateOrderDto['specification']) {
    return {
      color: specification.color.trim(),
      size: specification.size.trim(),
    };
  }

  private hasOnlyAllowedSpecificationFields(
    specification: Record<string, unknown>,
  ) {
    return Object.keys(specification).every((key) => {
      return key === 'color' || key === 'size';
    });
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async ensureOrderExists(orderNo: string) {
    const normalizedOrderNo = orderNo?.trim();

    if (!normalizedOrderNo) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND);
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: normalizedOrderNo },
    });

    if (!order) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND, {
        orderNo: normalizedOrderNo,
      });
    }

    return normalizedOrderNo;
  }

  private parseVersion(version: string | number, errorCode: DomainErrorCode) {
    const parsedVersion =
      typeof version === 'number' ? version : Number(version?.trim());

    if (!Number.isInteger(parsedVersion) || parsedVersion <= 0) {
      throw new DomainException(errorCode, { version });
    }

    return parsedVersion;
  }

  private buildVersionDifferences(
    from: {
      productName: string;
      quantity: number;
      unitPrice: unknown;
      specification: unknown;
      dueDate: Date;
      status: string;
    },
    to: {
      productName: string;
      quantity: number;
      unitPrice: unknown;
      specification: unknown;
      dueDate: Date;
      status: string;
    },
  ) {
    const differences: Record<
      string,
      { from: unknown; to: unknown; delta?: number; deltaDays?: number }
    > = {};

    this.addDifference(differences, 'quantity', from.quantity, to.quantity, {
      delta: to.quantity - from.quantity,
    });
    this.addDifference(
      differences,
      'productName',
      from.productName,
      to.productName,
    );
    this.addDifference(differences, 'unitPrice', from.unitPrice, to.unitPrice);
    this.addDifference(
      differences,
      'specification',
      from.specification,
      to.specification,
    );
    this.addDifference(differences, 'dueDate', from.dueDate, to.dueDate, {
      deltaDays: this.daysBetween(from.dueDate, to.dueDate),
    });
    this.addDifference(differences, 'status', from.status, to.status);

    return differences;
  }

  private addDifference(
    differences: Record<
      string,
      { from: unknown; to: unknown; delta?: number; deltaDays?: number }
    >,
    field: string,
    from: unknown,
    to: unknown,
    extra?: { delta?: number; deltaDays?: number },
  ) {
    const normalizedFrom = this.normalizeComparableValue(from);
    const normalizedTo = this.normalizeComparableValue(to);

    if (JSON.stringify(normalizedFrom) === JSON.stringify(normalizedTo)) {
      return;
    }

    differences[field] = {
      from: normalizedFrom,
      to: normalizedTo,
      ...(extra ?? {}),
    };
  }

  private normalizeComparableValue(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeComparableValue(item));
    }

    if (this.isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, item]) => [key, this.normalizeComparableValue(item)]),
      );
    }

    if (typeof value === 'object' && value !== null && 'toString' in value) {
      return value.toString();
    }

    return value;
  }

  private daysBetween(from: Date, to: Date) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return Math.round((to.getTime() - from.getTime()) / millisecondsPerDay);
  }

  private toInputJson(
    value: Prisma.JsonValue,
  ): Prisma.JsonNullValueInput | Prisma.InputJsonValue {
    if (value === null) {
      return Prisma.JsonNullValueInput.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private isUniqueConstraintError(error: unknown) {
    if (!this.isPlainObject(error) || error.code !== 'P2002') {
      return false;
    }

    return this.getUniqueConstraintFields(error).includes('order_no');
  }

  private getUniqueConstraintFields(error: Record<string, unknown>): string[] {
    const meta = error.meta;

    if (!this.isPlainObject(meta)) {
      return [];
    }

    if (Array.isArray(meta.target)) {
      return meta.target.filter((field): field is string => {
        return typeof field === 'string';
      });
    }

    const driverAdapterError = meta.driverAdapterError;

    if (!this.isPlainObject(driverAdapterError)) {
      return [];
    }

    const cause = driverAdapterError.cause;

    if (!this.isPlainObject(cause)) {
      return [];
    }

    const constraint = cause.constraint;

    if (!this.isPlainObject(constraint) || !Array.isArray(constraint.fields)) {
      return [];
    }

    return constraint.fields.filter((field): field is string => {
      return typeof field === 'string';
    });
  }
}
