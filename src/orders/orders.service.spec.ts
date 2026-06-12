import { Test, TestingModule } from '@nestjs/testing';
import { ActorRole } from '../common/entities/actor-role.entity';
import { DomainErrorCode, DomainException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    history: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let transaction: {
    order: { findUnique: jest.Mock; update: jest.Mock };
    history: { create: jest.Mock };
  };

  beforeEach(async () => {
    transaction = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      history: {
        create: jest.fn(),
      },
    };
    prisma = {
      order: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      history: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an initial draft order', async () => {
    const generatedOrderNo = `PO-${new Date().getFullYear()}-000001`;
    const dto: CreateOrderDto = {
      productName: ' 티셔츠 ',
      quantity: 1000,
      unitPrice: 5000,
      specification: {
        color: 'white',
        size: 'M',
      },
      dueDate: '2025-03-15',
      createdBy: ' buyer-user ',
      actorRole: ActorRole.BUYER,
    };
    const createdOrder = {
      id: 'order-id',
      orderNo: generatedOrderNo,
      productName: '티셔츠',
      quantity: 1000,
      unitPrice: 5000,
      specification: dto.specification,
      dueDate: new Date('2025-03-15'),
      status: 'DRAFT',
      version: 0,
      createdBy: 'buyer-user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockResolvedValue(createdOrder);

    await expect(service.create(dto)).resolves.toBe(createdOrder);
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        orderNo: {
          startsWith: `PO-${new Date().getFullYear()}-`,
        },
      },
      orderBy: {
        orderNo: 'desc',
      },
      select: {
        orderNo: true,
      },
    });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        orderNo: generatedOrderNo,
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: new Date('2025-03-15'),
        status: 'DRAFT',
        version: 0,
        createdBy: 'buyer-user',
      },
    });
  });

  it('generates the next order number from the latest yearly order', async () => {
    const currentYear = new Date().getFullYear();
    const generatedOrderNo = `PO-${currentYear}-000010`;
    const dto: CreateOrderDto = {
      productName: '티셔츠',
      quantity: 1000,
      unitPrice: 5000,
      specification: {
        color: 'white',
        size: 'M',
      },
      dueDate: '2025-03-15',
      createdBy: 'buyer-user',
      actorRole: ActorRole.BUYER,
    };
    const createdOrder = {
      id: 'order-id',
      orderNo: generatedOrderNo,
      productName: '티셔츠',
      quantity: 1000,
      unitPrice: 5000,
      specification: {
        color: 'white',
        size: 'M',
      },
      dueDate: new Date('2025-03-15'),
      status: 'DRAFT',
      version: 0,
      createdBy: 'buyer-user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.order.findFirst.mockResolvedValue({
      orderNo: `PO-${currentYear}-000009`,
    });
    prisma.order.create.mockResolvedValue(createdOrder);

    await expect(service.create(dto)).resolves.toBe(createdOrder);
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderNo: generatedOrderNo,
      }),
    });
  });

  it('rejects invalid create payloads', async () => {
    await expect(
      service.create({
        productName: '티셔츠',
        quantity: 0,
        unitPrice: 5000,
        specification: {} as any,
        dueDate: '2025-03-15',
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_CREATE_INVALID_PAYLOAD,
      },
    });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects specification fields other than color and size', async () => {
    await expect(
      service.create({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
          material: 'cotton',
        } as any,
        dueDate: '2025-03-15',
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_CREATE_INVALID_PAYLOAD,
      },
    });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects order creation by a non-buyer actor', async () => {
    await expect(
      service.create({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: '2025-03-15',
        createdBy: 'sourcing-user',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_CREATE_FORBIDDEN,
      },
    });
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('maps duplicate order numbers to a domain error', async () => {
    const generatedOrderNo = `PO-${new Date().getFullYear()}-000001`;
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['order_no'] },
    });

    await expect(
      service.create({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: '2025-03-15',
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toBeInstanceOf(DomainException);
    await expect(
      service.create({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: '2025-03-15',
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_ALREADY_EXISTS,
        details: { orderNo: generatedOrderNo },
      },
    });
  });

  it('maps adapter unique constraint errors to a duplicate order number domain error', async () => {
    const generatedOrderNo = `PO-${new Date().getFullYear()}-000001`;
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockRejectedValue({
      code: 'P2002',
      meta: {
        modelName: 'Order',
        driverAdapterError: {
          cause: {
            originalCode: '23505',
            constraint: {
              fields: ['order_no'],
            },
          },
        },
      },
    });

    await expect(
      service.create({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: '2025-03-15',
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_ALREADY_EXISTS,
        details: { orderNo: generatedOrderNo },
      },
    });
  });

  it('confirms a pending order and creates the initial history version', async () => {
    const pendingOrder = {
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
      status: 'PENDING',
      version: 0,
      createdBy: 'buyer-user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const confirmedOrder = {
      ...pendingOrder,
      status: 'CONFIRMED',
      version: 1,
    };
    const history = {
      id: 'history-id',
      orderNo: 'PO-2025-0001',
      requestId: null,
      version: 1,
      productName: '티셔츠',
      quantity: 1000,
      unitPrice: 5000,
      specification: pendingOrder.specification,
      dueDate: pendingOrder.dueDate,
      status: 'CONFIRMED',
      createdBy: 'buyer-user',
      changedFields: {
        status: {
          from: 'PENDING',
          to: 'CONFIRMED',
        },
      },
      approvedBy: 'sourcing-user',
      effectiveAt: new Date(),
      createdAt: new Date(),
    };

    transaction.order.findUnique.mockResolvedValue(pendingOrder);
    transaction.order.update.mockResolvedValue(confirmedOrder);
    transaction.history.create.mockResolvedValue(history);

    await expect(
      service.confirm(' PO-2025-0001 ', {
        confirmedBy: ' sourcing-user ',
        actorRole: ActorRole.SOURCING,
      }),
    ).resolves.toEqual({ order: confirmedOrder, history });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.order.findUnique).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
    });
    expect(transaction.order.update).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
      data: {
        status: 'CONFIRMED',
        version: 1,
      },
    });
    expect(transaction.history.create).toHaveBeenCalledWith({
      data: {
        orderNo: 'PO-2025-0001',
        requestId: null,
        version: 1,
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: pendingOrder.specification,
        dueDate: pendingOrder.dueDate,
        status: 'CONFIRMED',
        createdBy: 'buyer-user',
        changedFields: {
          status: {
            from: 'PENDING',
            to: 'CONFIRMED',
          },
        },
        approvedBy: 'sourcing-user',
        effectiveAt: expect.any(Date),
      },
    });
  });

  it('rejects order confirmation by a non-sourcing actor', async () => {
    await expect(
      service.confirm('PO-2025-0001', {
        confirmedBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_CONFIRM_FORBIDDEN,
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects order confirmation when the order does not exist', async () => {
    transaction.order.findUnique.mockResolvedValue(null);

    await expect(
      service.confirm('PO-2025-404', {
        confirmedBy: 'sourcing-user',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_NOT_FOUND,
        details: { orderNo: 'PO-2025-404' },
      },
    });
  });

  it('rejects order confirmation unless the order is pending review', async () => {
    transaction.order.findUnique.mockResolvedValue({
      orderNo: 'PO-2025-0001',
      status: 'DRAFT',
    });

    await expect(
      service.confirm('PO-2025-0001', {
        confirmedBy: 'sourcing-user',
        actorRole: ActorRole.SOURCING,
      }),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_CONFIRM_INVALID_STATUS,
        details: {
          orderNo: 'PO-2025-0001',
          currentStatus: 'DRAFT',
        },
      },
    });
  });

  it('lists orders by newest first', async () => {
    const orders = [
      {
        id: 'order-id',
        orderNo: 'PO-2025-0001',
      },
    ];
    prisma.order.findMany.mockResolvedValue(orders);

    await expect(service.findAll()).resolves.toBe(orders);
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('finds an order by order number', async () => {
    const order = {
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    };
    prisma.order.findUnique.mockResolvedValue(order);

    await expect(service.findOne(' PO-2025-0001 ')).resolves.toBe(order);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
    });
  });

  it('throws when an order cannot be found by order number', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(service.findOne('PO-2025-404')).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_NOT_FOUND,
        details: { orderNo: 'PO-2025-404' },
      },
    });
  });

  it('lists all approved order history snapshots by latest effective time', async () => {
    const histories = [
      {
        id: 'history-v2',
        orderNo: 'PO-2025-0001',
        version: 2,
      },
      {
        id: 'history-v1',
        orderNo: 'PO-2025-0002',
        version: 1,
      },
    ];

    prisma.history.findMany.mockResolvedValue(histories);

    await expect(service.findAllHistories()).resolves.toBe(histories);
    expect(prisma.history.findMany).toHaveBeenCalledWith({
      orderBy: [
        { effectiveAt: 'desc' },
        { createdAt: 'desc' },
        { orderNo: 'asc' },
        { version: 'desc' },
      ],
    });
  });

  it('lists approved order history snapshots in version order', async () => {
    const order = {
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    };
    const histories = [
      {
        id: 'history-v1',
        orderNo: 'PO-2025-0001',
        version: 1,
      },
      {
        id: 'history-v2',
        orderNo: 'PO-2025-0001',
        version: 2,
      },
    ];

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.history.findMany.mockResolvedValue(histories);

    await expect(service.findHistories(' PO-2025-0001 ')).resolves.toBe(
      histories,
    );
    expect(prisma.history.findMany).toHaveBeenCalledWith({
      where: { orderNo: 'PO-2025-0001' },
      orderBy: { version: 'asc' },
    });
  });

  it('finds a specific order version snapshot', async () => {
    const order = {
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    };
    const version2 = {
      id: 'history-v2',
      orderNo: 'PO-2025-0001',
      version: 2,
      quantity: 1500,
      dueDate: new Date('2025-03-15'),
    };

    prisma.order.findUnique.mockResolvedValue(order);
    prisma.history.findUnique.mockResolvedValue(version2);

    await expect(service.findVersion('PO-2025-0001', '2')).resolves.toBe(
      version2,
    );
    expect(prisma.history.findUnique).toHaveBeenCalledWith({
      where: {
        orderNo_version: {
          orderNo: 'PO-2025-0001',
          version: 2,
        },
      },
    });
  });

  it('throws when a specific order version does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    });
    prisma.history.findUnique.mockResolvedValue(null);

    await expect(
      service.findVersion('PO-2025-0001', '99'),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_VERSION_NOT_FOUND,
        details: {
          orderNo: 'PO-2025-0001',
          version: 99,
        },
      },
    });
  });

  it('finds the order snapshot that was effective at a specific time', async () => {
    const version2 = {
      id: 'history-v2',
      orderNo: 'PO-2025-0001',
      version: 2,
      quantity: 1500,
      dueDate: new Date('2025-03-15'),
      effectiveAt: new Date('2025-02-15T10:00:00.000Z'),
    };

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    });
    prisma.history.findFirst.mockResolvedValue(version2);

    await expect(service.findAsOf('PO-2025-0001', '2025-02-16')).resolves.toBe(
      version2,
    );
    expect(prisma.history.findFirst).toHaveBeenCalledWith({
      where: {
        orderNo: 'PO-2025-0001',
        effectiveAt: {
          lte: new Date('2025-02-16T14:59:59.999Z'),
        },
      },
      orderBy: [{ effectiveAt: 'desc' }, { version: 'desc' }],
    });
  });

  it('rejects an as-of query that is not a KST YYYY-MM-DD date', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    });

    await expect(
      service.findAsOf('PO-2025-0001', '2025-02-16T00:00:00.000Z'),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_HISTORY_INVALID_QUERY,
        details: {
          orderNo: 'PO-2025-0001',
          at: '2025-02-16T00:00:00.000Z',
          expectedFormat: 'YYYY-MM-DD',
          timezone: 'Asia/Seoul',
        },
      },
    });
    expect(prisma.history.findFirst).not.toHaveBeenCalled();
  });

  it('throws when no order version was effective at a specific time', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    });
    prisma.history.findFirst.mockResolvedValue(null);

    await expect(
      service.findAsOf('PO-2025-0001', '2025-02-01'),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_VERSION_AS_OF_NOT_FOUND,
      },
    });
  });

  it('compares two order versions and returns changed fields only', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    });
    prisma.history.findMany.mockResolvedValue([
      {
        id: 'history-v1',
        orderNo: 'PO-2025-0001',
        version: 1,
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: new Date('2025-03-15'),
        status: 'CONFIRMED',
      },
      {
        id: 'history-v3',
        orderNo: 'PO-2025-0001',
        version: 3,
        productName: '티셔츠',
        quantity: 1500,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: new Date('2025-03-25'),
        status: 'CONFIRMED',
      },
    ]);

    await expect(
      service.compareVersions('PO-2025-0001', '1', '3'),
    ).resolves.toEqual({
      orderNo: 'PO-2025-0001',
      fromVersion: 1,
      toVersion: 3,
      differences: {
        quantity: {
          from: 1000,
          to: 1500,
          delta: 500,
        },
        dueDate: {
          from: new Date('2025-03-15').toISOString(),
          to: new Date('2025-03-25').toISOString(),
          deltaDays: 10,
        },
      },
    });
  });

  it('throws when a compare target version does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-id',
      orderNo: 'PO-2025-0001',
    });
    prisma.history.findMany.mockResolvedValue([
      {
        id: 'history-v1',
        orderNo: 'PO-2025-0001',
        version: 1,
      },
    ]);

    await expect(
      service.compareVersions('PO-2025-0001', '1', '3'),
    ).rejects.toMatchObject({
      response: {
        code: DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND,
        details: {
          orderNo: 'PO-2025-0001',
          fromVersion: 1,
          toVersion: 3,
          foundVersions: [1],
        },
      },
    });
  });
});
