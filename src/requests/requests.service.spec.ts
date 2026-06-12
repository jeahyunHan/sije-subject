import { Test, TestingModule } from '@nestjs/testing';
import { ActorRole } from '../common/entities/actor-role.entity';
import { DomainErrorCode } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  let service: RequestsService;
  let prisma: {
    order: { findUnique: jest.Mock };
    request: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let transaction: {
    order: { findUnique: jest.Mock; update: jest.Mock };
    request: { findUnique: jest.Mock; update: jest.Mock };
    history: { create: jest.Mock };
  };

  const confirmedOrder = {
    id: 'order-id',
    orderNo: 'PO-2025-0001',
    productName: '티셔츠',
    quantity: 1000,
    unitPrice: 5000,
    specification: {
      color: 'white',
      size: 'M',
    },
    dueDate: new Date('2025-03-15'),
    status: 'CONFIRMED',
    version: 1,
    createdBy: 'buyer-user',
  };

  const createDto: CreateRequestDto = {
    orderNo: ' PO-2025-0001 ',
    reason: '수량 증가 및 납기 연장',
    requestedQuantity: 1500,
    requestedDueDate: '2025-03-25',
    requestedBy: ' buyer-user ',
    actorRole: ActorRole.BUYER,
  };

  beforeEach(async () => {
    transaction = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      request: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      history: {
        create: jest.fn(),
      },
    };
    prisma = {
      order: {
        findUnique: jest.fn(),
      },
      request: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a pending change request for a confirmed order', async () => {
    const createdRequest = {
      id: 'request-id',
      orderNo: 'PO-2025-0001',
      reason: '수량 증가 및 납기 연장',
      requestedQuantity: 1500,
      requestedDueDate: new Date('2025-03-25'),
      requestedBy: 'buyer-user',
      status: 'PENDING',
    };

    prisma.order.findUnique.mockResolvedValue(confirmedOrder);
    prisma.request.findFirst.mockResolvedValue(null);
    prisma.request.create.mockResolvedValue(createdRequest);

    await expect(service.create(createDto)).resolves.toBe(createdRequest);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
    });
    expect(prisma.request.findFirst).toHaveBeenCalledWith({
      where: {
        orderNo: 'PO-2025-0001',
        status: 'PENDING',
      },
    });
    expect(prisma.request.create).toHaveBeenCalledWith({
      data: {
        orderNo: 'PO-2025-0001',
        reason: '수량 증가 및 납기 연장',
        requestedQuantity: 1500,
        requestedDueDate: new Date('2025-03-25'),
        requestedBy: 'buyer-user',
        status: 'PENDING',
      },
    });
  });

  it('lists change requests by newest first', async () => {
    const requests = [
      {
        id: 'request-2',
        orderNo: 'PO-2025-0002',
        status: 'REJECTED',
      },
      {
        id: 'request-1',
        orderNo: 'PO-2025-0001',
        status: 'APPROVED',
      },
    ];
    prisma.request.findMany.mockResolvedValue(requests);

    await expect(service.findAll()).resolves.toBe(requests);
    expect(prisma.request.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
    });
  });

  it('filters change requests by order number', async () => {
    const requests = [
      {
        id: 'request-id',
        orderNo: 'PO-2025-0001',
        status: 'REJECTED',
      },
    ];
    prisma.request.findMany.mockResolvedValue(requests);

    await expect(service.findAll({ orderNo: ' PO-2025-0001 ' })).resolves.toBe(
      requests,
    );
    expect(prisma.request.findMany).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('filters change requests by status', async () => {
    const requests = [
      {
        id: 'request-id',
        orderNo: 'PO-2025-0001',
        status: 'APPROVED',
      },
    ];
    prisma.request.findMany.mockResolvedValue(requests);

    await expect(service.findAll({ status: 'APPROVED' })).resolves.toBe(
      requests,
    );
    expect(prisma.request.findMany).toHaveBeenCalledWith({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('filters change requests by order number and status', async () => {
    const requests = [
      {
        id: 'request-id',
        orderNo: 'PO-2025-0001',
        status: 'REJECTED',
      },
    ];
    prisma.request.findMany.mockResolvedValue(requests);

    await expect(
      service.findAll({
        orderNo: 'PO-2025-0001',
        status: 'REJECTED',
      }),
    ).resolves.toBe(requests);
    expect(prisma.request.findMany).toHaveBeenCalledWith({
      where: {
        orderNo: 'PO-2025-0001',
        status: 'REJECTED',
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns an empty list when no change request matches the filters', async () => {
    prisma.request.findMany.mockResolvedValue([]);

    await expect(service.findAll({ orderNo: 'PO-2025-NONE' })).resolves.toEqual(
      [],
    );
  });

  it('rejects invalid change request status filters', async () => {
    await expect(service.findAll({ status: 'DONE' })).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_INVALID_QUERY,
        details: {
          status: 'DONE',
          allowedStatuses: ['PENDING', 'APPROVED', 'REJECTED'],
        },
      },
    });
    expect(prisma.request.findMany).not.toHaveBeenCalled();
  });

  it('rejects change request creation by a non-buyer actor', async () => {
    await expect(
      service.create({
        ...createDto,
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_CREATE_FORBIDDEN,
      },
    });
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('rejects change request creation when no change field is provided', async () => {
    await expect(
      service.create({
        orderNo: 'PO-2025-0001',
        reason: '변경 요청',
        requestedBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_EMPTY_CHANGES,
      },
    });
  });

  it('rejects change request creation when the order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(service.create(createDto)).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_NOT_FOUND,
        details: { orderNo: 'PO-2025-0001' },
      },
    });
  });

  it('rejects change request creation for a completed order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...confirmedOrder,
      status: 'COMPLETED',
    });

    await expect(service.create(createDto)).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_COMPLETED_NOT_CHANGEABLE,
      },
    });
  });

  it('rejects change request creation for a non-changeable order status', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...confirmedOrder,
      status: 'DRAFT',
    });

    await expect(service.create(createDto)).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_NOT_CHANGEABLE,
        details: {
          orderNo: 'PO-2025-0001',
          currentStatus: 'DRAFT',
        },
      },
    });
  });

  it('rejects change request creation when another pending request exists', async () => {
    prisma.order.findUnique.mockResolvedValue(confirmedOrder);
    prisma.request.findFirst.mockResolvedValue({
      id: 'pending-request-id',
      orderNo: 'PO-2025-0001',
      status: 'PENDING',
    });

    await expect(service.create(createDto)).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_PENDING_EXISTS,
        details: {
          orderNo: 'PO-2025-0001',
          requestId: 'pending-request-id',
        },
      },
    });
  });

  it('rejects requested quantity that is not greater than the current quantity', async () => {
    prisma.order.findUnique.mockResolvedValue(confirmedOrder);
    prisma.request.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        ...createDto,
        requestedQuantity: 1000,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_QUANTITY_NOT_INCREASED,
        details: {
          currentQuantity: 1000,
          requestedQuantity: 1000,
        },
      },
    });
  });

  it('rejects requested due date that does not meet the minimum extension policy', async () => {
    prisma.order.findUnique.mockResolvedValue(confirmedOrder);
    prisma.request.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        ...createDto,
        requestedQuantity: undefined,
        requestedDueDate: '2025-03-15',
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_DUE_DATE_TOO_SOON,
      },
    });
  });

  it('approves a pending change request and stores a new order history version', async () => {
    const pendingRequest = {
      id: 'request-id',
      orderNo: 'PO-2025-0001',
      reason: '수량 증가 및 납기 연장',
      requestedQuantity: 1500,
      requestedDueDate: new Date('2025-03-25'),
      requestedBy: 'buyer-user',
      status: 'PENDING',
    };
    const updatedOrder = {
      ...confirmedOrder,
      quantity: 1500,
      dueDate: new Date('2025-03-25'),
      version: 2,
    };
    const updatedRequest = {
      ...pendingRequest,
      status: 'APPROVED',
      reviewedBy: 'sourcing-user',
      reviewComment: '생산 가능',
      reviewedAt: new Date(),
    };
    const history = {
      id: 'history-id',
      orderNo: 'PO-2025-0001',
      requestId: 'request-id',
      version: 2,
      productName: '티셔츠',
      quantity: 1500,
      unitPrice: 5000,
      specification: confirmedOrder.specification,
      dueDate: new Date('2025-03-25'),
      status: 'CONFIRMED',
      createdBy: 'buyer-user',
    };

    transaction.request.findUnique.mockResolvedValue(pendingRequest);
    transaction.order.findUnique.mockResolvedValue(confirmedOrder);
    transaction.order.update.mockResolvedValue(updatedOrder);
    transaction.request.update.mockResolvedValue(updatedRequest);
    transaction.history.create.mockResolvedValue(history);

    await expect(
      service.approve(' request-id ', {
        reviewedBy: ' sourcing-user ',
        reviewComment: ' 생산 가능 ',
        actorRole: ActorRole.SOURCING,
      }),
    ).resolves.toEqual({
      order: updatedOrder,
      request: updatedRequest,
      history,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.request.findUnique).toHaveBeenCalledWith({
      where: { id: 'request-id' },
    });
    expect(transaction.order.findUnique).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
    });
    expect(transaction.order.update).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
      data: {
        quantity: 1500,
        dueDate: new Date('2025-03-25'),
        version: 2,
      },
    });
    expect(transaction.request.update).toHaveBeenCalledWith({
      where: { id: 'request-id' },
      data: {
        status: 'APPROVED',
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 가능',
        reviewedAt: expect.any(Date),
      },
    });
    expect(transaction.history.create).toHaveBeenCalledWith({
      data: {
        orderNo: 'PO-2025-0001',
        requestId: 'request-id',
        version: 2,
        productName: '티셔츠',
        quantity: 1500,
        unitPrice: 5000,
        specification: confirmedOrder.specification,
        dueDate: new Date('2025-03-25'),
        status: 'CONFIRMED',
        createdBy: 'buyer-user',
        changedFields: {
          quantity: {
            from: 1000,
            to: 1500,
          },
          dueDate: {
            from: new Date('2025-03-15').toISOString(),
            to: new Date('2025-03-25').toISOString(),
          },
        },
        approvedBy: 'sourcing-user',
        effectiveAt: expect.any(Date),
      },
    });
  });

  it('approves the pending change request for an order number', async () => {
    const pendingRequest = {
      id: 'request-id',
      orderNo: 'PO-2025-0001',
      reason: '수량 증가 및 납기 연장',
      requestedQuantity: 1500,
      requestedDueDate: new Date('2025-03-25'),
      requestedBy: 'buyer-user',
      status: 'PENDING',
    };
    const updatedOrder = {
      ...confirmedOrder,
      quantity: 1500,
      dueDate: new Date('2025-03-25'),
      version: 2,
    };
    const updatedRequest = {
      ...pendingRequest,
      status: 'APPROVED',
      reviewedBy: 'sourcing-user',
      reviewComment: '생산 가능',
      reviewedAt: new Date(),
    };
    const history = {
      id: 'history-id',
      orderNo: 'PO-2025-0001',
      requestId: 'request-id',
      version: 2,
      productName: '티셔츠',
      quantity: 1500,
      unitPrice: 5000,
      specification: confirmedOrder.specification,
      dueDate: new Date('2025-03-25'),
      status: 'CONFIRMED',
      createdBy: 'buyer-user',
    };

    prisma.request.findFirst.mockResolvedValue(pendingRequest);
    transaction.request.findUnique.mockResolvedValue(pendingRequest);
    transaction.order.findUnique.mockResolvedValue(confirmedOrder);
    transaction.order.update.mockResolvedValue(updatedOrder);
    transaction.request.update.mockResolvedValue(updatedRequest);
    transaction.history.create.mockResolvedValue(history);

    await expect(
      service.approvePendingByOrderNo(' PO-2025-0001 ', {
        reviewedBy: ' sourcing-user ',
        reviewComment: ' 생산 가능 ',
        actorRole: ActorRole.SOURCING,
      }),
    ).resolves.toEqual({
      order: updatedOrder,
      request: updatedRequest,
      history,
    });
    expect(prisma.request.findFirst).toHaveBeenCalledWith({
      where: {
        orderNo: 'PO-2025-0001',
        status: 'PENDING',
      },
    });
    expect(transaction.request.findUnique).toHaveBeenCalledWith({
      where: { id: 'request-id' },
    });
  });

  it('rejects a pending change request without updating the order', async () => {
    const pendingRequest = {
      id: 'request-id',
      orderNo: 'PO-2025-0001',
      requestedQuantity: 1500,
      requestedDueDate: new Date('2025-03-25'),
      status: 'PENDING',
    };
    const rejectedRequest = {
      ...pendingRequest,
      status: 'REJECTED',
      reviewedBy: 'sourcing-user',
      reviewComment: '생산 일정 불가',
      reviewedAt: new Date(),
    };

    prisma.request.findUnique.mockResolvedValue(pendingRequest);
    prisma.request.update.mockResolvedValue(rejectedRequest);

    await expect(
      service.reject('request-id', {
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 일정 불가',
        actorRole: ActorRole.SOURCING,
      }),
    ).resolves.toBe(rejectedRequest);
    expect(prisma.request.update).toHaveBeenCalledWith({
      where: { id: 'request-id' },
      data: {
        status: 'REJECTED',
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 일정 불가',
        reviewedAt: expect.any(Date),
      },
    });
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('rejects the pending change request for an order number', async () => {
    const pendingRequest = {
      id: 'request-id',
      orderNo: 'PO-2025-0001',
      requestedQuantity: 1500,
      requestedDueDate: new Date('2025-03-25'),
      status: 'PENDING',
    };
    const rejectedRequest = {
      ...pendingRequest,
      status: 'REJECTED',
      reviewedBy: 'sourcing-user',
      reviewComment: '생산 일정 불가',
      reviewedAt: new Date(),
    };

    prisma.request.findFirst.mockResolvedValue(pendingRequest);
    prisma.request.findUnique.mockResolvedValue(pendingRequest);
    prisma.request.update.mockResolvedValue(rejectedRequest);

    await expect(
      service.rejectPendingByOrderNo(' PO-2025-0001 ', {
        reviewedBy: ' sourcing-user ',
        reviewComment: ' 생산 일정 불가 ',
        actorRole: ActorRole.SOURCING,
      }),
    ).resolves.toBe(rejectedRequest);
    expect(prisma.request.findFirst).toHaveBeenCalledWith({
      where: {
        orderNo: 'PO-2025-0001',
        status: 'PENDING',
      },
    });
    expect(prisma.request.update).toHaveBeenCalledWith({
      where: { id: 'request-id' },
      data: {
        status: 'REJECTED',
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 일정 불가',
        reviewedAt: expect.any(Date),
      },
    });
  });

  it('rejects order-number review when no pending change request exists', async () => {
    prisma.request.findFirst.mockResolvedValue(null);

    await expect(
      service.approvePendingByOrderNo('PO-2025-0001', {
        reviewedBy: 'sourcing-user',
        reviewComment: '승인',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_PENDING_NOT_FOUND,
        details: {
          orderNo: 'PO-2025-0001',
          status: 'PENDING',
        },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects approval by a non-sourcing actor', async () => {
    await expect(
      service.approve('request-id', {
        reviewedBy: 'buyer-user',
        reviewComment: '승인',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_REVIEW_FORBIDDEN,
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a review comment when approving or rejecting', async () => {
    await expect(
      service.reject('request-id', {
        reviewedBy: 'sourcing-user',
        reviewComment: ' ',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_REVIEW_COMMENT_REQUIRED,
      },
    });
  });

  it('rejects approval when the change request does not exist', async () => {
    transaction.request.findUnique.mockResolvedValue(null);

    await expect(
      service.approve('request-id', {
        reviewedBy: 'sourcing-user',
        reviewComment: '승인',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_NOT_FOUND,
      },
    });
  });

  it('rejects approval when the change request is already closed', async () => {
    transaction.request.findUnique.mockResolvedValue({
      id: 'request-id',
      status: 'APPROVED',
    });

    await expect(
      service.approve('request-id', {
        reviewedBy: 'sourcing-user',
        reviewComment: '승인',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.CHANGE_REQUEST_ALREADY_CLOSED,
        details: {
          requestId: 'request-id',
          currentStatus: 'APPROVED',
        },
      },
    });
  });

  it('maps unexpected approval transaction errors to a transaction failure domain error', async () => {
    prisma.$transaction.mockRejectedValue(new Error('database failure'));

    await expect(
      service.approve('request-id', {
        reviewedBy: 'sourcing-user',
        reviewComment: '승인',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.APPROVAL_TRANSACTION_FAILED,
      },
    });
  });
});
