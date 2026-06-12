import { Injectable } from '@nestjs/common';
import {
  OrderStatus as PrismaOrderStatus,
  Prisma,
  RequestStatus as PrismaRequestStatus,
} from '@prisma/client';
import { ActorRole } from '../common/entities/actor-role.entity';
import { DomainErrorCode, DomainException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { FindRequestsQueryDto } from './dto/find-requests-query.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { REQUEST_POLICY } from './request-policy';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRequestDto: CreateRequestDto) {
    const data = this.buildCreateData(createRequestDto);

    if (createRequestDto.actorRole !== ActorRole.BUYER) {
      throw new DomainException(
        DomainErrorCode.CHANGE_REQUEST_CREATE_FORBIDDEN,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: data.orderNo },
    });

    if (!order) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND, {
        orderNo: data.orderNo,
      });
    }

    if (order.status === PrismaOrderStatus.COMPLETED) {
      throw new DomainException(
        DomainErrorCode.ORDER_COMPLETED_NOT_CHANGEABLE,
        {
          orderNo: data.orderNo,
        },
      );
    }

    if (
      order.status !== PrismaOrderStatus.CONFIRMED &&
      order.status !== PrismaOrderStatus.IN_PRODUCTION
    ) {
      throw new DomainException(DomainErrorCode.ORDER_NOT_CHANGEABLE, {
        orderNo: data.orderNo,
        currentStatus: order.status,
      });
    }

    const pendingRequest = await this.prisma.request.findFirst({
      where: {
        orderNo: data.orderNo,
        status: PrismaRequestStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_PENDING_EXISTS, {
        orderNo: data.orderNo,
        requestId: pendingRequest.id,
      });
    }

    this.validateRequestedChanges(data, order);

    return this.prisma.request.create({
      data: {
        orderNo: data.orderNo,
        reason: data.reason,
        requestedQuantity: data.requestedQuantity ?? null,
        requestedDueDate: data.requestedDueDate ?? null,
        requestedBy: data.requestedBy,
        status: PrismaRequestStatus.PENDING,
      },
    });
  }

  async approve(id: string, reviewRequestDto: ReviewRequestDto) {
    const review = this.buildReviewData(id, reviewRequestDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.request.findUnique({
          where: { id: review.id },
        });

        this.ensureRequestCanBeReviewed(request);

        const order = await tx.order.findUnique({
          where: { orderNo: request.orderNo },
        });

        if (!order) {
          throw new DomainException(DomainErrorCode.ORDER_NOT_FOUND, {
            orderNo: request.orderNo,
          });
        }

        if (order.status === PrismaOrderStatus.COMPLETED) {
          throw new DomainException(
            DomainErrorCode.ORDER_COMPLETED_NOT_CHANGEABLE,
            {
              orderNo: request.orderNo,
            },
          );
        }

        if (
          order.status !== PrismaOrderStatus.CONFIRMED &&
          order.status !== PrismaOrderStatus.IN_PRODUCTION
        ) {
          throw new DomainException(DomainErrorCode.ORDER_NOT_CHANGEABLE, {
            orderNo: request.orderNo,
            currentStatus: order.status,
          });
        }

        this.validateRequestedChanges(
          {
            orderNo: request.orderNo,
            reason: request.reason,
            requestedBy: request.requestedBy,
            requestedQuantity: request.requestedQuantity ?? undefined,
            requestedDueDate: request.requestedDueDate ?? undefined,
          },
          order,
        );

        const nextVersion = order.version + 1;
        const changedFields = this.buildChangedFields(request, order);
        const reviewedAt = new Date();
        const updatedOrder = await tx.order.update({
          where: { orderNo: request.orderNo },
          data: {
            ...(request.requestedQuantity !== null
              ? { quantity: request.requestedQuantity }
              : {}),
            ...(request.requestedDueDate !== null
              ? { dueDate: request.requestedDueDate }
              : {}),
            version: nextVersion,
          },
        });
        const updatedRequest = await tx.request.update({
          where: { id: review.id },
          data: {
            status: PrismaRequestStatus.APPROVED,
            reviewedBy: review.reviewedBy,
            reviewComment: review.reviewComment,
            reviewedAt,
          },
        });
        const history = await tx.history.create({
          data: {
            orderNo: updatedOrder.orderNo,
            requestId: updatedRequest.id,
            version: updatedOrder.version,
            productName: updatedOrder.productName,
            quantity: updatedOrder.quantity,
            unitPrice: updatedOrder.unitPrice,
            specification: this.toInputJson(updatedOrder.specification),
            dueDate: updatedOrder.dueDate,
            status: updatedOrder.status,
            createdBy: updatedOrder.createdBy,
            changedFields,
            approvedBy: review.reviewedBy,
            effectiveAt: reviewedAt,
          },
        });

        return { order: updatedOrder, request: updatedRequest, history };
      });
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      throw new DomainException(DomainErrorCode.APPROVAL_TRANSACTION_FAILED);
    }
  }

  async approvePendingByOrderNo(
    orderNo: string,
    reviewRequestDto: ReviewRequestDto,
  ) {
    this.buildReviewerData(reviewRequestDto);
    const request = await this.findPendingRequestByOrderNo(orderNo);

    return this.approve(request.id, reviewRequestDto);
  }

  async reject(id: string, reviewRequestDto: ReviewRequestDto) {
    const review = this.buildReviewData(id, reviewRequestDto);
    const request = await this.prisma.request.findUnique({
      where: { id: review.id },
    });

    this.ensureRequestCanBeReviewed(request);

    return this.prisma.request.update({
      where: { id: review.id },
      data: {
        status: PrismaRequestStatus.REJECTED,
        reviewedBy: review.reviewedBy,
        reviewComment: review.reviewComment,
        reviewedAt: new Date(),
      },
    });
  }

  async rejectPendingByOrderNo(
    orderNo: string,
    reviewRequestDto: ReviewRequestDto,
  ) {
    this.buildReviewerData(reviewRequestDto);
    const request = await this.findPendingRequestByOrderNo(orderNo);

    return this.reject(request.id, reviewRequestDto);
  }

  async findAll(query: FindRequestsQueryDto = {}) {
    const where = this.buildFindWhere(query);

    return this.prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildCreateData(createRequestDto: CreateRequestDto) {
    const orderNo = createRequestDto.orderNo?.trim();
    const reason = createRequestDto.reason?.trim();
    const requestedBy = createRequestDto.requestedBy?.trim();
    const requestedQuantity = createRequestDto.requestedQuantity;
    const hasRequestedQuantity =
      requestedQuantity !== undefined && requestedQuantity !== null;
    const hasRequestedDueDate =
      createRequestDto.requestedDueDate !== undefined &&
      createRequestDto.requestedDueDate !== null;
    const requestedDueDate = hasRequestedDueDate
      ? new Date(createRequestDto.requestedDueDate as string)
      : undefined;

    if (!orderNo || !reason || !requestedBy) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_INVALID_CHANGES);
    }

    if (!hasRequestedQuantity && !hasRequestedDueDate) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_EMPTY_CHANGES);
    }

    if (
      hasRequestedQuantity &&
      (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0)
    ) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_INVALID_CHANGES);
    }

    if (hasRequestedDueDate && Number.isNaN(requestedDueDate?.getTime())) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_INVALID_CHANGES);
    }

    return {
      orderNo,
      reason,
      requestedBy,
      requestedQuantity: hasRequestedQuantity ? requestedQuantity : undefined,
      requestedDueDate,
    };
  }

  private buildFindWhere(
    query: FindRequestsQueryDto,
  ): Prisma.RequestWhereInput {
    const orderNo = query.orderNo?.trim();
    const status = this.parseRequestStatus(query.status);

    return {
      ...(orderNo ? { orderNo } : {}),
      ...(status ? { status } : {}),
    };
  }

  private parseRequestStatus(status?: string): PrismaRequestStatus | undefined {
    const normalizedStatus = status?.trim();

    if (!normalizedStatus) {
      return undefined;
    }

    if (
      !Object.values(PrismaRequestStatus).includes(
        normalizedStatus as PrismaRequestStatus,
      )
    ) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_INVALID_QUERY, {
        status,
        allowedStatuses: Object.values(PrismaRequestStatus),
      });
    }

    return normalizedStatus as PrismaRequestStatus;
  }

  private buildReviewData(id: string, reviewRequestDto: ReviewRequestDto) {
    const normalizedId = id?.trim();

    if (!normalizedId) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_NOT_FOUND);
    }

    return {
      id: normalizedId,
      ...this.buildReviewerData(reviewRequestDto),
    };
  }

  private buildReviewerData(reviewRequestDto: ReviewRequestDto) {
    const reviewedBy = reviewRequestDto.reviewedBy?.trim();
    const reviewComment = reviewRequestDto.reviewComment?.trim();

    if (reviewRequestDto.actorRole !== ActorRole.SOURCING) {
      throw new DomainException(
        DomainErrorCode.CHANGE_REQUEST_REVIEW_FORBIDDEN,
      );
    }

    if (!reviewedBy || !reviewComment) {
      throw new DomainException(
        DomainErrorCode.CHANGE_REQUEST_REVIEW_COMMENT_REQUIRED,
      );
    }

    return {
      reviewedBy,
      reviewComment,
    };
  }

  private async findPendingRequestByOrderNo(orderNo: string) {
    const normalizedOrderNo = orderNo?.trim();

    if (!normalizedOrderNo) {
      throw new DomainException(
        DomainErrorCode.CHANGE_REQUEST_PENDING_NOT_FOUND,
      );
    }

    const request = await this.prisma.request.findFirst({
      where: {
        orderNo: normalizedOrderNo,
        status: PrismaRequestStatus.PENDING,
      },
    });

    if (!request) {
      throw new DomainException(
        DomainErrorCode.CHANGE_REQUEST_PENDING_NOT_FOUND,
        {
          orderNo: normalizedOrderNo,
          status: PrismaRequestStatus.PENDING,
        },
      );
    }

    return request;
  }

  private ensureRequestCanBeReviewed<
    T extends { id: string; status: PrismaRequestStatus } | null,
  >(request: T): asserts request is Exclude<T, null> {
    if (!request) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_NOT_FOUND);
    }

    if (request.status !== PrismaRequestStatus.PENDING) {
      throw new DomainException(DomainErrorCode.CHANGE_REQUEST_ALREADY_CLOSED, {
        requestId: request.id,
        currentStatus: request.status,
      });
    }
  }

  private buildChangedFields(
    request: {
      requestedQuantity: number | null;
      requestedDueDate: Date | null;
    },
    order: { quantity: number; dueDate: Date },
  ): Prisma.InputJsonValue {
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};

    if (request.requestedQuantity !== null) {
      changedFields.quantity = {
        from: order.quantity,
        to: request.requestedQuantity,
      };
    }

    if (request.requestedDueDate !== null) {
      changedFields.dueDate = {
        from: order.dueDate.toISOString(),
        to: request.requestedDueDate.toISOString(),
      };
    }

    return changedFields as Prisma.InputJsonValue;
  }

  private validateRequestedChanges(
    data: ReturnType<RequestsService['buildCreateData']>,
    order: { quantity: number; dueDate: Date },
  ) {
    if (
      data.requestedQuantity !== undefined &&
      data.requestedQuantity <= order.quantity
    ) {
      throw new DomainException(
        DomainErrorCode.CHANGE_REQUEST_QUANTITY_NOT_INCREASED,
        {
          currentQuantity: order.quantity,
          requestedQuantity: data.requestedQuantity,
        },
      );
    }

    if (data.requestedDueDate !== undefined) {
      const minDueDate = this.addDays(
        order.dueDate,
        REQUEST_POLICY.minDueDateExtensionDays,
      );

      if (data.requestedDueDate < minDueDate) {
        throw new DomainException(
          DomainErrorCode.CHANGE_REQUEST_DUE_DATE_TOO_SOON,
          {
            currentDueDate: order.dueDate,
            requestedDueDate: data.requestedDueDate,
            minDueDate,
          },
        );
      }
    }
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);

    return nextDate;
  }

  private toInputJson(
    value: Prisma.JsonValue,
  ): Prisma.JsonNullValueInput | Prisma.InputJsonValue {
    if (value === null) {
      return Prisma.JsonNullValueInput.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }
}
