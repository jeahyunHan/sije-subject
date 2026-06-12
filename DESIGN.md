# 변경 이력 관리 설계

## 1. 선택한 방식

### 개요

선택한 방식은 현재 상태 테이블 + 승인 버전별 전체 스냅샷 + 변경 필드 delta 저장 방식입니다.

구조는 다음과 같습니다.

- `Order`: 발주서의 최신 상태만 저장합니다.
- `Request`: 주문자가 요청한 변경 내용과 소싱팀의 승인/반려 검토 결과를 저장합니다.
- `History`: 승인되어 실제 발주서에 반영된 각 버전의 전체 발주서 상태를 스냅샷으로 저장합니다.
- `History.changedFields`: 해당 버전에서 실제로 바뀐 필드의 `from`, `to` 값을 함께 저장합니다.

`History`는 전체 스냅샷을 저장하되 변경된 필드 정보도 같이 저장합니다.
이 방식은 질문에서 고민했던 "전체 데이터를 저장할 것인가?", "델타만 저장할 것인가?", "둘 다 저장할 것인가?" 중 둘 다 저장하는 방식에 해당합니다. 둘 다 저장하는 방식을 택한 이유는

1. 프로젝트 평가 범위 제외 사항 중 대용량 데이터 처리 (수십만 건 이상) 에 대한 사항을 고려하였습니다. 스냅샷과 델타 데이터의 저장으로 용량에 대한 문제보다 중요한 핵심 기능인 이력관리를 위해 해당 방법을 택했습니다.
2. 변경 이력 조회 핵심 기능 중 '각 변경 시점의 발주서 전체 상태 또는 변경된 필드 정보를 확인할 수 있어야 함'의 요구사항에 대하여 수량 및 납기일 뿐이 아니라 완전한 이력 보존을 위해 발주서의 모든 데이터가 저장되어야 한다고 생각했습니다.

중요한 설계 원칙은 다음과 같습니다.

1. `Order`는 최신 버전의 발주서에 대해 조회를 빠르고 단순하게 하기 위한 현재 상태 테이블입니다.
2. `History`는 승인된 버전의 감사 및 과거 조회를 위한 불변 스냅샷 테이블입니다.
3. `Request`에는 변경할 값만 저장하고, 변경 전 현재값은 DB에 저장되어 있는 발주서 데이터를 기준으로 합니다.
4. 변경 승인 시점에는 반드시 DB의 최신 `Order`를 다시 조회해 현재값을 기준으로 검증하고 이력을 생성합니다.
5. 반려된 변경 요청은 발주서 상태를 바꾸지 않으므로 `History`에 저장하지 않고 `Request`에 검토 결과만 남깁니다.

### 데이터 구조

#### ERD

```mermaid
erDiagram
  Order ||--o{ Request : "has change requests"
  Order ||--o{ History : "has approved versions"
  Request ||--o| History : "creates approved history"

  Order {
    uuid id PK
    string orderNo UK
    string productName
    int quantity
    decimal unitPrice
    json specification
    datetime dueDate
    enum status
    int version
    string createdBy
    datetime createdAt
    datetime updatedAt
  }

  Request {
    uuid id PK
    string orderNo FK
    string reason
    int requestedQuantity
    datetime requestedDueDate
    string requestedBy
    string reviewedBy
    string reviewComment
    datetime reviewedAt
    enum status
    datetime createdAt
    datetime updatedAt
  }

  History {
    uuid id PK
    string orderNo FK
    uuid requestId UK
    int version
    string productName
    int quantity
    decimal unitPrice
    json specification
    datetime dueDate
    enum status
    string createdBy
    json changedFields
    string approvedBy
    datetime effectiveAt
    datetime createdAt
  }
```

#### Order

`Order`는 발주서의 현재 최신 상태입니다.

| 필드                     | 의미                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `id`                     | 내부 UUID                                                            |
| `orderNo`                | 시스템이 생성하는 발주서 관리번호. 예: `PO-2026-000001`              |
| `productName`            | 상품명                                                               |
| `quantity`               | 현재 발주 수량                                                       |
| `unitPrice`              | 단가                                                                 |
| `specification`          | 사양 정보 JSON. 현재는 `color`, `size`만 허용                        |
| `dueDate`                | 현재 납기일. 업무상 날짜 값이며 API에서는 `YYYY-MM-DD` 형식으로 받음 |
| `status`                 | `DRAFT`, `PENDING`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED`        |
| `version`                | 현재 발주서 버전. 생성 시 0, 확정 시 1                               |
| `createdBy`              | 발주 생성자                                                          |
| `createdAt`, `updatedAt` | 생성/수정 시각                                                       |

#### Request

`Request`는 변경 요청과 검토 결과입니다.

| 필드                     | 의미                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `id`                     | 내부 UUID                                                             |
| `orderNo`                | 변경 대상 발주서 관리번호                                             |
| `reason`                 | 변경 사유                                                             |
| `requestedQuantity`      | 변경할 수량. 변경하지 않으면 `null`                                   |
| `requestedDueDate`       | 변경할 납기일. `YYYY-MM-DD` 형식의 날짜 값이며 변경하지 않으면 `null` |
| `requestedBy`            | 변경 요청자                                                           |
| `reviewedBy`             | 승인/반려 처리자                                                      |
| `reviewComment`          | 승인/반려 검토 의견                                                   |
| `reviewedAt`             | 승인/반려 처리 시각                                                   |
| `status`                 | `PENDING`, `APPROVED`, `REJECTED`                                     |
| `createdAt`, `updatedAt` | 생성/수정 시각                                                        |

#### History

`History`는 승인된 버전의 전체 발주서 스냅샷입니다.

| 필드                                                                         | 의미                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `id`                                                                         | 내부 UUID                                                     |
| `orderNo`                                                                    | 발주서 관리번호                                               |
| `requestId`                                                                  | 해당 이력을 만든 변경 요청 ID. 초기 확정 이력은 `null`        |
| `version`                                                                    | 발주서 버전                                                   |
| `productName`, `quantity`, `unitPrice`, `specification`, `dueDate`, `status` | 해당 버전 당시의 전체 발주서 상태                             |
| `createdBy`                                                                  | 최초 발주 생성자                                              |
| `changedFields`                                                              | 해당 버전에서 변경된 필드의 `from`, `to` 값                   |
| `approvedBy`                                                                 | 확정 또는 승인 처리자                                         |
| `effectiveAt`                                                                | 해당 버전이 실제로 유효해진 시각. 서버가 생성하는 이벤트 시각 |
| `createdAt`                                                                  | History row 생성 시각                                         |

#### 날짜와 시간 처리 기준

이 설계에서는 날짜 성격의 값과 이벤트 시각 성격의 값을 구분합니다.

| 구분        | 대상 필드                                             | 의미                                             | 입력/생성 기준                     |
| ----------- | ----------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| 업무 날짜   | `dueDate`, `requestedDueDate`                         | 납품이 필요한 날짜                               | API에서 `YYYY-MM-DD` 형식으로 입력 |
| 이벤트 시각 | `createdAt`, `updatedAt`, `reviewedAt`, `effectiveAt` | 생성, 수정, 검토, 버전 유효화가 실제 발생한 시각 | 서버에서 생성                      |

`dueDate`와 `requestedDueDate`는 시간대가 중요한 이벤트 시각이 아니라 업무상 날짜입니다. 다만 Prisma/PostgreSQL에서는 `DateTime`으로 저장하므로 내부적으로는 Date 객체로 다룹니다. API 입력은 `2025-03-15`처럼 날짜만 받는 것을 기준으로 합니다.

`effectiveAt`은 특정 버전이 실제로 유효해진 시각입니다. 초기 확정 또는 변경 승인 순간에 서버에서 생성되며, 특정 시점 조회의 기준 필드로 사용합니다.

주요 제약과 인덱스는 다음과 같습니다.

| 대상                                  | 목적                                              |
| ------------------------------------- | ------------------------------------------------- |
| `Order.orderNo` unique                | 발주서 관리번호 중복 방지                         |
| `Request(orderNo, status)` index      | 특정 발주서의 대기 중 변경 요청 조회              |
| `History(orderNo, version)` unique    | 같은 발주서의 동일 버전 중복 방지                 |
| `History(orderNo, effectiveAt)` index | 특정 시점 조회 성능 확보                          |
| `History.requestId` unique            | 하나의 승인 요청이 하나의 History만 만들도록 보장 |

### 동작 방식

#### 변경 승인 시 어떻게 저장되는가?

초기 확정과 변경 승인 모두 `History`를 생성합니다.

1. 주문자가 발주서를 생성하면 `Order.version = 0`입니다.
2. 소싱팀이 발주서를 확정하면 `Order.status = CONFIRMED`, `Order.version = 1`로 바뀌고 `History v1`이 생성됩니다.
3. 이후 변경 요청이 승인될 때마다 `Order.version`을 1 증가시키고, 변경 후의 전체 `Order` 상태를 `History`에 새 버전으로 저장합니다.

예시는 다음과 같습니다.

| 시점             | Order 최신 상태      | History |
| ---------------- | -------------------- | ------- |
| 발주 생성        | version 0, PENDING   | 없음    |
| 초기 확정        | version 1, CONFIRMED | v1 생성 |
| 수량 변경 승인   | version 2, CONFIRMED | v2 생성 |
| 납기일 변경 승인 | version 3, CONFIRMED | v3 생성 |

승인 처리는 하나의 트랜잭션에서 실행합니다.

1. `Request`가 `PENDING`인지 확인합니다.
2. `Order`를 DB에서 다시 조회합니다.
3. 현재 `Order` 기준으로 변경 요청 값의 유효성을 검증합니다.
4. `Order` 최신값과 version을 업데이트합니다.
5. `Request.status`를 `APPROVED`로 바꾸고 검토 정보를 기록합니다.
6. 변경 후 전체 발주서 상태를 `History`에 저장합니다.

이때 `Order` 업데이트, `Request` 승인 처리, `History` 저장은 하나의 트랜잭션입니다. 승인 처리 중 오류가 발생하면 모든 변경사항이 롤백됩니다.

반려는 발주서에 반영되지 않는 결정입니다. 따라서 `History`에는 저장하지 않고 `Request.status = REJECTED`, `reviewedBy`, `reviewComment`, `reviewedAt`만 기록합니다.

#### 특정 시점 조회 시 어떻게 데이터를 가져오는가?

특정 시점 조회는 `History.effectiveAt`을 기준으로 합니다.

`effectiveAt`은 해당 버전이 실제로 발주서의 유효 상태가 된 시각입니다. 초기 확정 또는 변경 승인 처리 시각과 같습니다.

조회 방식은 다음과 같습니다.

1. `orderNo`로 발주서 존재 여부를 확인합니다.
2. 조회 기준 일자 `at`을 `YYYY-MM-DD` 형식으로 전달받습니다.
3. `at`이 `YYYY-MM-DD` 형식이 아니거나 실제 존재하지 않는 날짜이면 `ORDER_HISTORY_INVALID_QUERY`를 반환합니다.
4. 해당 일자를 한국시간(Asia/Seoul) 기준 일자 종료 시각으로 변환합니다.
5. `History`에서 `orderNo`가 같고 `effectiveAt <= 변환된 시각`인 row를 찾습니다.
6. 그 중 `effectiveAt desc`, `version desc` 기준 첫 번째 row를 반환합니다.

예를 들어 다음과 이력이 조회된다고 가정 했을 때,

| version | effectiveAt (KST)   | quantity | dueDate    |
| ------- | ------------------- | -------- | ---------- |
| 1       | 2025-02-10 09:00:00 | 1000     | 2025-03-15 |
| 2       | 2025-02-15 10:00:00 | 1500     | 2025-03-15 |
| 3       | 2025-02-20 10:00:00 | 1500     | 2025-03-25 |

`2025-02-16` 기준 조회 시 한국시간 `2025-02-16 23:59:59.999`까지 유효해진 버전 중 가장 최신인 v2를 반환합니다.
내부 비교 시각은 UTC로 환산하면 `2025-02-16T14:59:59.999Z`입니다.

#### 변경 비교는 어떻게 수행하는가?

버전 비교는 두 개의 `History` 스냅샷을 가져와 필드별로 비교합니다.

비교 대상 필드는 다음과 같습니다.

- `quantity`
- `productName`
- `unitPrice`
- `specification`
- `dueDate`
- `status`

비교 결과는 변경된 필드만 반환합니다.

예시:

```json
{
  "orderNo": "PO-2026-000001",
  "fromVersion": 1,
  "toVersion": 3,
  "differences": {
    "quantity": {
      "from": 1000,
      "to": 1500,
      "delta": 500
    },
    "dueDate": {
      "from": "2025-03-15T00:00:00.000Z",
      "to": "2025-03-25T00:00:00.000Z",
      "deltaDays": 10
    }
  }
}
```

수량은 `delta`, 납기일은 `deltaDays`를 함께 제공합니다.
`dueDate`는 업무상 날짜이지만 내부 비교에서는 Date 값을 ISO 문자열로 정규화합니다. 따라서 응답의 `from`, `to`는 `2025-03-15T00:00:00.000Z`처럼 반환되고, 실제 날짜 차이는 `deltaDays`로 확인합니다.

## 2. 의사결정 과정

### 고려했던 대안들

#### 대안 1. History에 전체 스냅샷만 저장

변경이 승인될 때마다 발주서 전체 데이터를 `History`에 저장하는 방식입니다.

- 특정 버전 조회가 매우 단순합니다.
- 특정 시점 조회도 가장 가까운 스냅샷 하나를 찾으면 조회하면 됩니다.
- 과거 상태 복원이 쉬워집니다.

선택하지 않은 이유

- 변경된 필드만 빠르게 확인하기 위해서는 스냅샷 간 비교하는 로직이 필요합니다.
- 변경된 값만 저장하는 방식보다 저장 공간을 더 사용합니다.

#### 대안 2. 기존 Order 테이블에 version을 추가하고 여러 row를 저장할 것 인가??

`orders` 테이블에 같은 `orderNo`를 가진 여러 row를 version별로 저장하는 방식입니다.

- 별도 History 테이블 없이 버전별 발주서를 저장할 수 있습니다.
- 버전 조회가 직관적입니다.

선택하지 않은 이유

- 최신 발주서와 과거 발주서를 같은 테이블에서 구분해야 합니다.
- `orderNo` unique 제약을 그대로 사용할 수 없습니다.
- 발주서 최신 상태 조회, 변경 요청 관계, 생산자 읽기 모델이 복잡해집니다.
- 현재 상태와 이력 상태의 데이터가 섞이기 때문에 일관성이 없어집니다.

#### 대안 3. 이벤트 스트림 방식으로 처리할 것 인가??

- 시스템의 모든 변경 사항(생성, 수정, 삭제)을 이벤트 로그로 영구 저장하여 강력한 변경 이력 검증이 가능합니다.
- 감사와 추적에는 강력합니다.

선택하지 않은 이유

- 주어진 일정과 요구사항에 대해 해당 방식은 과하다는 생각이 들었습니다.
- 해당 방식에 대해선 러닝커브가 발생할 것으로 판단되어 제외하였습니다.

### 최종적으로 선택한 방법의 이유

제가 최종으로 선택한 방법은 Order 최신 상태 + History 전체 스냅샷 + changedFields(JSONB)를 활용했습니다.

#### 우리 도메인의 특성상 최신 발주서 조회와 과거 이력 조회가 모두 중요하다고 생각했습니다.

생산자는 항상 최신 확정 발주서 기준으로 생산해야 하므로 최신 상태 조회가 단순해야 합니다. 이를 위해 `Order`는 현재 상태만 갖습니다.
반면 주문자와 소싱팀은 과거 변경 내역, 특정 버전, 특정 시점 상태, 버전 간 차이를 확인해야 합니다. 이를 위해 `History`는 승인된 버전별 전체 상태를 보존합니다.
발주서는 나아가 회사의 이익 또는 손실과도 직결되기 때문에 이력 조회 기능이 중요하다고 생각했습니다.

#### 요구사항 중 특정 버전 조회와 특정 시점 조회가 중요합니다.

요구사항에는 다음 조회가 포함됩니다.

- 특정 버전 조회
- 특정 시점 조회
- 변경 이력 조회
- 버전 간 비교

변경사항만 저장하면 특정 버전이나 특정 시점의 전체 상태를 만들기 위해 매번 재구성이 필요합니다.
하지만 전체 스냅샷을 저장하면 `History` 한 row만 조회하면 당시 전체 발주서 상태를 반환할 수 있습니다.

#### 변경 비교도 필요하므로 changedFields를 함께 저장합니다.

전체 스냅샷만 있으면 버전 간 비교는 가능하지만 매번 전체 필드를 비교해야 합니다. 그래서 승인 시점에 `changedFields`도 함께 저장합니다.

`changedFields`는 다음 용도로 사용됩니다.

- 변경 이력 목록에서 어떤 필드가 바뀌었는지 빠르게 표시
- 감사 로그에서 "무엇이 바뀌었는가?"를 명확히 표현
- 변경 요청 승인 시 DB의 현재값 기준으로 `from`, 요청값 기준으로 `to` 저장

단, 버전 비교 API는 두 `History` 스냅샷을 직접 비교합니다. 이렇게 하면 `changedFields` 누락이나 추가 필드 확장에도 비교 결과를 안정적으로 계산할 수 있습니다.

#### 구현 복잡도와 효과의 균형이 좋습니다.

이번 과제에서는 대용량 데이터 처리, 동시성 제어, 분산 시스템, 캐싱 전략은 평가 대상이 아닙니다.
과한 기능보다는 주어진 요구사항을 명확하게 만족하고 이해하기 쉬운 테이블 구조로 작성하는 것이 더 적합 하다고 생각했습니다.

전체 스냅샷 + changedFields 방식은...

- 구현은 단순합니다.
- 과거 조회는 빠르고 명확합니다.
- 변경 비교도 가능합니다.
- 감사 데이터가 충분히 남습니다.

#### 클라이언트가 보내는 현재값을 신뢰하지 않는 구조입니다.

초기 설계 검토 중 `Request`에 현재 수량, 현재 납기일을 같이 저장할지 고민하고 최종적으로는 제거했습니다.

이유는 다음과 같습니다.

- 클라이언트 화면의 현재값은 이미 오래된 값일 수 있습니다.
- 사용자가 임의로 현재값을 조작해서 보낼 수 있습니다.
- 동일 발주서에 `PENDING` 요청이 있으면 새 요청을 막고 있지만, 그래도 승인 시점의 진짜 기준은 DB의 `Order`입니다.
- 승인 시점에는 DB에서 `Order`를 다시 조회해 현재값을 기준으로 `changedFields.from`을 만들어야 신뢰도가 높습니다.

따라서 `Request`는 요청자가 바꾸고 싶은 목표값만 저장하고, 변경 전 현재값은 승인 처리 시점에 DB에서 조회합니다.

## 3. 구현 상세

### 핵심 로직 설명

#### 발주서 생성

발주서 생성은 주문자만 가능합니다. `orderNo`는 클라이언트 입력을 받지 않고 서버에서 생성합니다.

관리번호 규칙은 다음과 같습니다.

```text
PO-{YYYY}-{6자리 순번}
예: PO-2026-000001
```

생성 시 `Order.version = 0`입니다. 아직 소싱팀이 확정하지 않은 상태이므로 `History`는 생성하지 않습니다.

#### 발주서 초기 확정

소싱팀이 `PENDING` 발주서를 확정하면 다음 작업을 트랜잭션으로 수행합니다.

```ts
const updatedOrder = await tx.order.update({
  where: { orderNo },
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
    specification: updatedOrder.specification,
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
```

이때 생성되는 `History v1`이 최초로 조회 가능한 확정 버전입니다.

#### 변경 요청 생성

변경 요청 생성 시 `Request`에는 변경할 값만 저장합니다.

```ts
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
```

생성 규칙은 다음과 같습니다.

- 주문자(`BUYER`)만 생성할 수 있습니다.
- 발주서가 존재해야 합니다.
- 발주서 상태가 `CONFIRMED` 또는 `IN_PRODUCTION`이어야 합니다.
- `COMPLETED` 상태는 변경 요청할 수 없습니다.
- 동일 발주서에 `PENDING` 변경 요청이 있으면 생성할 수 없습니다.
- 변경 항목은 수량 또는 납기일 중 1개 이상이어야 합니다.
- 요청 수량은 현재 DB 수량보다 커야 합니다.
- 요청 납기일은 현재 DB 납기일보다 최소 정책 일수 이상 연장되어야 합니다.

#### 변경 요청 승인

승인 API는 `PATCH /requests/{orderNo}/approve`입니다. 외부 API에서는 `orderNo`를 받아 해당 발주서의 `PENDING` 변경 요청을 찾습니다.

내부 처리 흐름은 다음과 같습니다.

```ts
return await this.prisma.$transaction(async (tx) => {
  const request = await tx.request.findUnique({ where: { id } });
  this.ensureRequestCanBeReviewed(request);

  const order = await tx.order.findUnique({
    where: { orderNo: request.orderNo },
  });

  this.validateRequestedChanges(request, order);

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
    where: { id },
    data: {
      status: PrismaRequestStatus.APPROVED,
      reviewedBy,
      reviewComment,
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
      specification: updatedOrder.specification,
      dueDate: updatedOrder.dueDate,
      status: updatedOrder.status,
      createdBy: updatedOrder.createdBy,
      changedFields,
      approvedBy: reviewedBy,
      effectiveAt: reviewedAt,
    },
  });

  return { order: updatedOrder, request: updatedRequest, history };
});
```

핵심은 `Order` 업데이트, `Request` 승인 처리, `History` 저장이 모두 같은 트랜잭션 안에 있다는 점입니다. `History` 생성 중 unique 제약 오류 등 예외가 발생하면 `Order`와 `Request` 변경도 롤백됩니다.

#### 변경 필드 계산

`changedFields`는 승인 시점에 DB에서 조회한 현재 `Order`를 기준으로 생성합니다.

```ts
const changedFields = {};

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
```

이 방식은 클라이언트가 보낸 현재값을 믿지 않고 DB의 현재 발주서 상태를 기준으로 이력을 생성합니다.

#### 변경 요청 반려

반려는 발주서 상태를 변경하지 않습니다.

```ts
return this.prisma.request.update({
  where: { id },
  data: {
    status: PrismaRequestStatus.REJECTED,
    reviewedBy,
    reviewComment,
    reviewedAt: new Date(),
  },
});
```

반려 시 `History`를 만들지 않는 이유는 발주서의 유효 버전이 바뀌지 않았기 때문입니다. 대신 `Request`에 누가, 언제, 어떤 의견으로 반려했는지 남겨 감사 요구사항을 충족합니다.

#### 변경 이력 조회

전체 변경 이력 조회:

```ts
return this.prisma.history.findMany({
  orderBy: [
    { effectiveAt: 'desc' },
    { createdAt: 'desc' },
    { orderNo: 'asc' },
    { version: 'desc' },
  ],
});
```

특정 발주서 변경 이력 조회:

```ts
return this.prisma.history.findMany({
  where: { orderNo },
  orderBy: { version: 'asc' },
});
```

#### 특정 버전 조회

특정 버전 조회는 `History(orderNo, version)` unique 제약을 사용합니다.

```ts
const history = await this.prisma.history.findUnique({
  where: {
    orderNo_version: {
      orderNo,
      version,
    },
  },
});
```

#### 특정 시점 조회

특정 시점 조회는 `YYYY-MM-DD` 형식의 한국시간 일자를 기준으로 해당 날짜의 마지막 시점까지 유효해진 최신 버전을 찾습니다.

```ts
if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) {
  throw new DomainException(DomainErrorCode.ORDER_HISTORY_INVALID_QUERY);
}

const [year, month, day] = at.split('-').map(Number);
const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

if (year < 1000 || month < 1 || month > 12 || day < 1 || day > lastDayOfMonth) {
  throw new DomainException(DomainErrorCode.ORDER_HISTORY_INVALID_QUERY);
}

const effectiveAt = new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999));

const history = await this.prisma.history.findFirst({
  where: {
    orderNo,
    effectiveAt: {
      lte: effectiveAt,
    },
  },
  orderBy: [{ effectiveAt: 'desc' }, { version: 'desc' }],
});
```

#### 버전 간 비교

두 버전의 `History`를 조회한 뒤 필드별로 비교합니다.

```ts
const histories = await this.prisma.history.findMany({
  where: {
    orderNo,
    version: {
      in: [fromVersion, toVersion],
    },
  },
});

return {
  orderNo,
  fromVersion,
  toVersion,
  differences: this.buildVersionDifferences(from, to),
};
```

비교 시 Date는 ISO 문자열로 정규화하고, JSON 객체는 key 순서를 정렬해 비교합니다. 이렇게 하면 `{ color, size }` 순서 차이 같은 표현상의 차이로 잘못된 변경이 잡히지 않습니다.

### 예외 상황 처리

#### 발주서 생성 및 확정

| 상황                             | 에러 코드                      | 설명                                         |
| -------------------------------- | ------------------------------ | -------------------------------------------- |
| 주문자가 아닌 사용자가 발주 생성 | `ORDER_CREATE_FORBIDDEN`       | `actorRole`이 `BUYER`가 아님                 |
| 발주 생성 payload 오류           | `ORDER_CREATE_INVALID_PAYLOAD` | 상품명, 수량, 단가, 사양, 납기일 등 오류     |
| 발주서 관리번호 중복             | `ORDER_ALREADY_EXISTS`         | unique constraint 오류를 domain error로 변환 |
| 존재하지 않는 발주서 조회/확정   | `ORDER_NOT_FOUND`              | `orderNo`에 해당하는 발주서 없음             |
| 소싱팀이 아닌 사용자가 확정      | `ORDER_CONFIRM_FORBIDDEN`      | `actorRole`이 `SOURCING`이 아님              |
| `PENDING`이 아닌 발주서 확정     | `ORDER_CONFIRM_INVALID_STATUS` | 확정 가능한 상태가 아님                      |

#### 변경 요청 생성

| 상황                              | 에러 코드                               | 설명                              |
| --------------------------------- | --------------------------------------- | --------------------------------- |
| 주문자가 아닌 사용자가 변경 요청  | `CHANGE_REQUEST_CREATE_FORBIDDEN`       | `actorRole`이 `BUYER`가 아님      |
| 변경 항목 없음                    | `CHANGE_REQUEST_EMPTY_CHANGES`          | 수량/납기일 모두 없음             |
| 변경 값 형식 오류                 | `CHANGE_REQUEST_INVALID_CHANGES`        | 수량, 납기일, 사유 등 값 오류     |
| 발주서가 확정/생산중 상태가 아님  | `ORDER_NOT_CHANGEABLE`                  | 변경 요청 가능한 상태가 아님      |
| 발주서가 완료 상태                | `ORDER_COMPLETED_NOT_CHANGEABLE`        | 완료 발주서는 변경 불가           |
| 대기 중 변경 요청 존재            | `CHANGE_REQUEST_PENDING_EXISTS`         | 같은 발주서에 `PENDING` 요청 존재 |
| 요청 수량이 현재 수량 이하        | `CHANGE_REQUEST_QUANTITY_NOT_INCREASED` | 수량 증가 정책 위반               |
| 요청 납기일이 최소 연장 일수 미만 | `CHANGE_REQUEST_DUE_DATE_TOO_SOON`      | 납기일 정책 위반                  |

#### 변경 요청 승인/반려

| 상황                          | 에러 코드                                | 설명                                    |
| ----------------------------- | ---------------------------------------- | --------------------------------------- |
| 해당 발주서의 대기 요청 없음  | `CHANGE_REQUEST_PENDING_NOT_FOUND`       | `orderNo + PENDING` 요청 없음           |
| 소싱팀이 아닌 사용자가 처리   | `CHANGE_REQUEST_REVIEW_FORBIDDEN`        | `actorRole`이 `SOURCING`이 아님         |
| 검토 의견 없음                | `CHANGE_REQUEST_REVIEW_COMMENT_REQUIRED` | 승인/반려 시 검토 의견 필수             |
| 이미 승인/반려된 요청 처리    | `CHANGE_REQUEST_ALREADY_CLOSED`          | `PENDING` 상태가 아님                   |
| 승인 트랜잭션 중 예상 외 오류 | `APPROVAL_TRANSACTION_FAILED`            | `Order`, `Request`, `History` 변경 롤백 |

#### 이력 조회 및 비교

| 상황                          | 에러 코드                                | 설명                                                   |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 존재하지 않는 버전 조회       | `ORDER_VERSION_NOT_FOUND`                | `orderNo + version` History 없음                       |
| 특정 시점 조회 날짜 형식 오류 | `ORDER_HISTORY_INVALID_QUERY`            | `at`이 `YYYY-MM-DD` 형식이 아니거나 존재하지 않는 날짜 |
| 특정 시점에 유효한 버전 없음  | `ORDER_VERSION_AS_OF_NOT_FOUND`          | 해당 시점 이전의 History 없음                          |
| 비교 대상 버전 없음           | `ORDER_VERSION_COMPARE_TARGET_NOT_FOUND` | from/to 중 하나 이상 없음                              |

### 테스트와 검증

구현은 다음 테스트로 검증합니다.

| 구분                | 검증 내용                                                                         |
| ------------------- | --------------------------------------------------------------------------------- |
| 변경 저장           | 승인 시 `Order.version` 증가, `Request.status = APPROVED`, `History` 새 버전 생성 |
| 여러 필드 동시 변경 | 수량과 납기일을 동시에 변경해도 하나의 승인 요청이 하나의 버전으로 저장           |
| 이력 조회           | 특정 버전, `YYYY-MM-DD` 한국시간 기준 특정 시점, 전체 이력, 특정 발주서 이력 조회 |
| 변경 비교           | 두 버전 간 변경 필드와 수량 `delta`, 납기일 `from/to`, `deltaDays` 반환           |
| 반려                | `Order`와 `History`는 변경하지 않고 `Request`에 검토 결과만 저장                  |
| 트랜잭션 롤백       | History 생성 실패 시 Order/Request 변경사항 롤백                                  |
| 통합 시나리오       | 생성 -> 확정 -> 변경요청 -> 반려 -> 재요청 -> 승인 -> 이력조회 -> 비교            |

실행 명령:

```bash
npm test -- --runInBand --verbose
```

PostgreSQL e2e:

```bash
export DATABASE_URL="postgresql://purchase_user:purchase_password@localhost:15433/purchase_order?schema=public"
npm run test:e2e
```

Docker 배포 검증:

```bash
git clone https://github.com/jeahyunHan/sije-subject.git
cd sije-subject
docker compose up --build
```
