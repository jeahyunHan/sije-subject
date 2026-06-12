import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ActorRole } from '../src/common/entities/actor-role.entity';
import { OrderStatus } from '../src/orders/entities/order.entity';
import { RequestStatus } from '../src/requests/entities/request.entity';

describe('Purchase order flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for e2e tests.');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  async function cleanDatabase() {
    await prisma.history.deleteMany();
    await prisma.request.deleteMany();
    await prisma.order.deleteMany();
  }

  it('runs the full create, confirm, reject, approve, history read flow against PostgreSQL', async () => {
    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .send({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: '2025-03-15',
        status: OrderStatus.PENDING,
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      })
      .expect(201);

    const orderNo = createdOrder.body.orderNo;

    expect(orderNo).toMatch(/^PO-\d{4}-\d{6}$/);
    expect(createdOrder.body).toMatchObject({
      orderNo,
      productName: '티셔츠',
      quantity: 1000,
      status: OrderStatus.PENDING,
      version: 0,
      createdBy: 'buyer-user',
    });

    const confirmed = await request(app.getHttpServer())
      .patch(`/orders/${orderNo}/confirm`)
      .send({
        confirmedBy: 'sourcing-user',
        actorRole: ActorRole.SOURCING,
      })
      .expect(200);

    expect(confirmed.body.order).toMatchObject({
      orderNo,
      productName: '티셔츠',
      status: OrderStatus.CONFIRMED,
      version: 1,
      createdBy: 'buyer-user',
    });
    expect(confirmed.body.history).toMatchObject({
      orderNo,
      version: 1,
      productName: '티셔츠',
      quantity: 1000,
      status: OrderStatus.CONFIRMED,
      createdBy: 'buyer-user',
    });

    const firstRequest = await request(app.getHttpServer())
      .post('/requests')
      .send({
        orderNo,
        reason: '납기 연장 검토 요청',
        requestedDueDate: '2025-03-25',
        requestedBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      })
      .expect(201);

    expect(firstRequest.body).toMatchObject({
      orderNo,
      reason: '납기 연장 검토 요청',
      status: RequestStatus.PENDING,
    });

    await request(app.getHttpServer())
      .get('/requests')
      .query({ orderNo })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: firstRequest.body.id,
          orderNo,
          status: RequestStatus.PENDING,
        });
      });

    const rejected = await request(app.getHttpServer())
      .patch(`/requests/${orderNo}/reject`)
      .send({
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 일정 불가',
        actorRole: ActorRole.SOURCING,
      })
      .expect(200);

    expect(rejected.body).toMatchObject({
      id: firstRequest.body.id,
      status: RequestStatus.REJECTED,
      reviewedBy: 'sourcing-user',
      reviewComment: '생산 일정 불가',
      reviewedAt: expect.any(String),
    });

    await request(app.getHttpServer())
      .get('/requests')
      .query({ orderNo, status: RequestStatus.REJECTED })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          id: firstRequest.body.id,
          status: RequestStatus.REJECTED,
          reviewedBy: 'sourcing-user',
          reviewComment: '생산 일정 불가',
          reviewedAt: expect.any(String),
        });
      });

    await request(app.getHttpServer())
      .get(`/orders/${orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo,
          productName: '티셔츠',
          quantity: 1000,
          version: 1,
        });
        expect(new Date(body.dueDate).toISOString()).toBe(
          new Date('2025-03-15').toISOString(),
        );
      });

    await request(app.getHttpServer())
      .get(`/histories/${orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          orderNo,
          version: 1,
          productName: '티셔츠',
        });
      });

    await request(app.getHttpServer())
      .get('/histories')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          orderNo,
          version: 1,
          productName: '티셔츠',
        });
      });

    const secondRequest = await request(app.getHttpServer())
      .post('/requests')
      .send({
        orderNo,
        reason: '수량 증가 및 납기 연장',
        requestedQuantity: 1500,
        requestedDueDate: '2025-03-25',
        requestedBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      })
      .expect(201);

    const approved = await request(app.getHttpServer())
      .patch(`/requests/${orderNo}/approve`)
      .send({
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 가능',
        actorRole: ActorRole.SOURCING,
      })
      .expect(200);

    expect(approved.body.order).toMatchObject({
      orderNo,
      productName: '티셔츠',
      quantity: 1500,
      version: 2,
    });
    expect(new Date(approved.body.order.dueDate).toISOString()).toBe(
      new Date('2025-03-25').toISOString(),
    );
    expect(approved.body.request).toMatchObject({
      id: secondRequest.body.id,
      status: RequestStatus.APPROVED,
      reviewedBy: 'sourcing-user',
      reviewComment: '생산 가능',
      reviewedAt: expect.any(String),
    });
    expect(approved.body.history).toMatchObject({
      orderNo,
      requestId: secondRequest.body.id,
      version: 2,
      productName: '티셔츠',
      quantity: 1500,
      createdBy: 'buyer-user',
    });

    await request(app.getHttpServer())
      .get('/histories')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(2);
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              orderNo,
              version: 1,
              quantity: 1000,
            }),
            expect.objectContaining({
              orderNo,
              version: 2,
              quantity: 1500,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .get(`/histories/${orderNo}/versions/2`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo,
          version: 2,
          productName: '티셔츠',
          quantity: 1500,
        });
      });

    await request(app.getHttpServer())
      .get(`/histories/${orderNo}/as-of`)
      .query({ at: approved.body.history.effectiveAt })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo,
          version: 2,
          productName: '티셔츠',
          quantity: 1500,
        });
      });

    await request(app.getHttpServer())
      .get(`/histories/${orderNo}/compare`)
      .query({ fromVersion: 1, toVersion: 2 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo,
          fromVersion: 1,
          toVersion: 2,
          differences: {
            quantity: {
              from: 1000,
              to: 1500,
              delta: 500,
            },
            dueDate: {
              deltaDays: 10,
            },
          },
        });
      });

    await request(app.getHttpServer())
      .patch(`/requests/${orderNo}/approve`)
      .send({
        reviewedBy: 'sourcing-user',
        reviewComment: '추가 승인 시도',
        actorRole: ActorRole.SOURCING,
      })
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'CHANGE_REQUEST_PENDING_NOT_FOUND',
          details: {
            orderNo,
            status: RequestStatus.PENDING,
          },
        });
      });
  });

  it('rolls back order and request updates when approval history creation fails', async () => {
    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .send({
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: '2025-03-15',
        status: OrderStatus.PENDING,
        createdBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      })
      .expect(201);

    const orderNo = createdOrder.body.orderNo;

    await request(app.getHttpServer())
      .patch(`/orders/${orderNo}/confirm`)
      .send({
        confirmedBy: 'sourcing-user',
        actorRole: ActorRole.SOURCING,
      })
      .expect(200);

    const changeRequest = await request(app.getHttpServer())
      .post('/requests')
      .send({
        orderNo,
        reason: '롤백 검증용 수량 증가',
        requestedQuantity: 1500,
        requestedDueDate: '2025-03-25',
        requestedBy: 'buyer-user',
        actorRole: ActorRole.BUYER,
      })
      .expect(201);

    await prisma.history.create({
      data: {
        orderNo,
        requestId: null,
        version: 2,
        productName: '티셔츠',
        quantity: 1000,
        unitPrice: 5000,
        specification: {
          color: 'white',
          size: 'M',
        },
        dueDate: new Date('2025-03-15'),
        status: OrderStatus.CONFIRMED,
        createdBy: 'buyer-user',
        changedFields: {
          test: {
            reason: 'approval history create conflict',
          },
        },
        approvedBy: 'test-setup',
      },
    });

    await request(app.getHttpServer())
      .patch(`/requests/${orderNo}/approve`)
      .send({
        reviewedBy: 'sourcing-user',
        reviewComment: '생산 가능',
        actorRole: ActorRole.SOURCING,
      })
      .expect(500)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'APPROVAL_TRANSACTION_FAILED',
          stage: 'APPROVAL_TRANSACTION',
        });
      });

    const orderAfterFailure = await prisma.order.findUniqueOrThrow({
      where: { orderNo },
    });
    const requestAfterFailure = await prisma.request.findUniqueOrThrow({
      where: { id: changeRequest.body.id },
    });
    const approvalHistory = await prisma.history.findFirst({
      where: {
        orderNo,
        requestId: changeRequest.body.id,
      },
    });

    expect(orderAfterFailure).toMatchObject({
      orderNo,
      productName: '티셔츠',
      quantity: 1000,
      status: OrderStatus.CONFIRMED,
      version: 1,
      createdBy: 'buyer-user',
    });
    expect(orderAfterFailure.dueDate.toISOString()).toBe(
      new Date('2025-03-15').toISOString(),
    );
    expect(requestAfterFailure).toMatchObject({
      id: changeRequest.body.id,
      orderNo,
      status: RequestStatus.PENDING,
      reviewedBy: null,
      reviewComment: null,
      reviewedAt: null,
    });
    expect(approvalHistory).toBeNull();
  });
});
