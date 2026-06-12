# Purchase Order Change Management API

의류 생산 발주서의 생성, 소싱팀 확정, 주문자 변경 요청, 승인/반려, 변경 이력 조회를 구현한 NestJS API입니다.

핵심 과제는 발주서가 여러 번 변경될 수 있는 상황에서 아래 요구사항을 만족하는 변경 이력 관리입니다.

- 과거 시점 조회: 특정 날짜/시간 당시의 발주서 상태 조회
- 변경 추적: 누가, 언제, 무엇을, 왜 변경했는지 기록
- 비교 기능: 두 버전 사이의 필드별 변경 내용 비교
- 감사 보존: 승인된 변경 이력을 `History`에 버전 스냅샷으로 보존

## 기술 스택

- Node.js
- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Jest
- Swagger
- Docker, Docker Compose

## 도메인 흐름

```text
[주문자] 발주서 생성
  ↓
[소싱팀] 초기 검토 및 발주서 확정
  ↓
[주문자] 변경 요청 생성
  ↓
[소싱팀] 변경 요청 검토
  ├─ 승인: 발주서 최신값 업데이트 + History 새 버전 저장
  └─ 반려: 발주서 유지 + Request에 검토 정보 저장
  ↓
[생산자] 최신 발주서 확인
```

## 데이터 모델 요약

### Order

발주서의 최신 상태를 저장합니다.

| 필드 | 설명 |
| --- | --- |
| `orderNo` | 시스템이 생성하는 발주서 관리번호. 예: `PO-2026-000001` |
| `productName` | 상품명 |
| `quantity` | 현재 수량 |
| `unitPrice` | 단가 |
| `specification` | 사양 정보 JSON. 현재 `color`, `size`만 허용 |
| `dueDate` | 현재 납기일 |
| `status` | `DRAFT`, `PENDING`, `CONFIRMED`, `IN_PRODUCTION`, `COMPLETED` |
| `version` | 현재 발주서 버전 |
| `createdBy` | 발주 생성자 |

### Request

발주서 변경 요청과 승인/반려 검토 결과를 저장합니다.

| 필드 | 설명 |
| --- | --- |
| `orderNo` | 변경 대상 발주서 관리번호 |
| `reason` | 변경 사유 |
| `requestedQuantity` | 변경할 수량 |
| `requestedDueDate` | 변경할 납기일 |
| `requestedBy` | 변경 요청자 |
| `reviewedBy` | 승인/반려 처리자 |
| `reviewComment` | 승인/반려 검토 의견 |
| `reviewedAt` | 승인/반려 처리 시각 |
| `status` | `PENDING`, `APPROVED`, `REJECTED` |

### History

승인된 발주서 상태를 버전 스냅샷으로 저장합니다.

| 필드 | 설명 |
| --- | --- |
| `orderNo` | 발주서 관리번호 |
| `requestId` | 승인된 변경 요청 ID. 초기 확정 이력은 `null` |
| `version` | 발주서 버전 |
| `productName`, `quantity`, `unitPrice`, `specification`, `dueDate`, `status` | 해당 버전 당시의 전체 발주서 상태 |
| `changedFields` | 변경된 필드의 이전값/이후값 |
| `approvedBy` | 확정 또는 승인 처리자 |
| `effectiveAt` | 해당 버전이 유효해진 시각 |

## 과제 제출용 실행 방법

이 프로젝트는 **Public GitHub Repository + Docker Compose** 방식으로 실행하는 것을 기본 제출 방식으로 합니다.

평가자는 별도의 Node.js 또는 PostgreSQL 설치 없이 Docker만 설치된 환경에서 아래 순서로 실행할 수 있습니다.
Docker Hub 이미지를 별도로 pull하지 않고, 저장소의 `Dockerfile`과 `docker-compose.yml`로 로컬에서 이미지를 빌드합니다.

### 1. 저장소 clone

```bash
git clone https://github.com/jeahyunHan/sije-subject.git
cd sije-subject
```

### 2. Docker Compose 실행

```bash
docker compose up --build
```

위 명령은 아래 컨테이너를 함께 실행합니다.

- `app`: NestJS API 서버
- `postgres`: PostgreSQL 15

앱 컨테이너는 시작 시 `prisma db push`를 실행하여 PostgreSQL에 Prisma schema를 자동 반영한 뒤 서버를 실행합니다.

### 3. 접속 정보

```text
API      http://localhost:3000
Swagger  http://localhost:3000/api-docs
Postgres localhost:15433
```

### 4. 종료

컨테이너만 종료:

```bash
docker compose down
```

컨테이너와 DB 볼륨까지 삭제:

```bash
docker compose down -v
```

## 실행 방법 상세

### 1. Docker Compose로 실행

소스코드를 받은 환경에서 PostgreSQL까지 포함해 한 번에 실행할 수 있습니다.

```bash
docker compose up --build
```

실행 후 접속 정보:

```text
API      http://localhost:3000
Swagger  http://localhost:3000/api-docs
Postgres localhost:15433
```

### 2. 로컬 Node.js로 실행

설치:

```bash
npm install
```

환경변수 설정:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:15432/purchase_order_test?schema=public"
```

Prisma 스키마 반영:

```bash
npx prisma db push --schema=prisma/schema.prisma
```

서버 실행:

```bash
npm run start
```

개발 모드:

```bash
npm run start:dev
```

## 환경 설정

### Node.js

권장 버전:

```text
Node.js 22.x
```

### PostgreSQL

로컬 DB를 직접 사용할 경우 `DATABASE_URL`을 설정해야 합니다.

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"
```

현재 로컬 Docker PostgreSQL 컨테이너를 사용할 경우 예시:

```bash
DB_USER=$(docker exec core-postgres-dev printenv POSTGRES_USER)
DB_PASSWORD=$(docker exec core-postgres-dev printenv POSTGRES_PASSWORD)

docker exec core-postgres-dev createdb -U "$DB_USER" purchase_order_test

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:15432/purchase_order_test?schema=public"
```

`purchase_order_test` DB가 이미 있으면 `createdb` 명령은 실패할 수 있습니다. 이 경우 기존 DB를 그대로 사용해도 됩니다.

### Docker Compose 기본 DB

`docker-compose.yml`의 기본 DB 접속 정보:

```text
host: localhost
port: 15433
database: purchase_order
user: purchase_user
password: purchase_password
```

애플리케이션 컨테이너 내부에서는 아래 URL을 사용합니다.

```text
postgresql://purchase_user:purchase_password@postgres:5432/purchase_order?schema=public
```

## API 명세

Swagger 문서:

```text
http://localhost:3000/api-docs
```

### Orders

| Method | Path | 설명 |
| --- | --- | --- |
| `POST` | `/orders` | 발주서 생성 |
| `GET` | `/orders` | 발주서 목록 조회 |
| `GET` | `/orders/{orderNo}` | 발주서 최신 상태 조회 |
| `PATCH` | `/orders/{orderNo}/confirm` | 소싱팀 발주서 초기 확정 및 `History v1` 생성 |

### Requests

| Method | Path | 설명 |
| --- | --- | --- |
| `POST` | `/requests` | 변경 요청 생성 |
| `GET` | `/requests` | 변경 요청 목록 조회 |
| `PATCH` | `/requests/{orderNo}/approve` | 해당 발주서의 `PENDING` 변경 요청 승인 |
| `PATCH` | `/requests/{orderNo}/reject` | 해당 발주서의 `PENDING` 변경 요청 반려 |

`GET /requests` query:

| Query | 설명 |
| --- | --- |
| `orderNo` | 특정 발주서의 변경 요청만 조회 |
| `status` | `PENDING`, `APPROVED`, `REJECTED` |

### Histories

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/histories` | 모든 발주서의 전체 변경 이력 조회 |
| `GET` | `/histories/{orderNo}` | 특정 발주서 변경 이력 조회 |
| `GET` | `/histories/{orderNo}/versions/{version}` | 특정 버전 조회 |
| `GET` | `/histories/{orderNo}/as-of?at=2025-02-15T10:00:00.000Z` | 특정 시점 기준 발주서 상태 조회 |
| `GET` | `/histories/{orderNo}/compare?fromVersion=1&toVersion=2` | 버전 간 변경 내용 비교 |

## 요청 예시

### 발주서 생성

```json
{
  "productName": "티셔츠",
  "quantity": 1000,
  "unitPrice": 5000,
  "specification": {
    "color": "white",
    "size": "M"
  },
  "dueDate": "2025-03-15",
  "status": "PENDING",
  "createdBy": "buyer-user",
  "actorRole": "BUYER"
}
```

### 발주서 확정

```json
{
  "confirmedBy": "sourcing-user",
  "actorRole": "SOURCING"
}
```

### 변경 요청 생성

```json
{
  "orderNo": "PO-2026-000001",
  "reason": "수량 증가 및 납기 연장",
  "requestedQuantity": 1500,
  "requestedDueDate": "2025-03-25",
  "requestedBy": "buyer-user",
  "actorRole": "BUYER"
}
```

### 변경 요청 승인

```json
{
  "reviewedBy": "sourcing-user",
  "reviewComment": "생산 가능",
  "actorRole": "SOURCING"
}
```

### 변경 요청 반려

```json
{
  "reviewedBy": "sourcing-user",
  "reviewComment": "생산 일정상 납기 연장 불가",
  "actorRole": "SOURCING"
}
```

## 주요 비즈니스 규칙

- 발주서 생성은 주문자(`BUYER`)만 가능합니다.
- 발주서 확정은 소싱팀(`SOURCING`)만 가능합니다.
- 변경 요청은 주문자(`BUYER`)만 생성할 수 있습니다.
- 변경 요청은 `CONFIRMED`, `IN_PRODUCTION` 상태의 발주서에만 생성할 수 있습니다.
- `COMPLETED` 상태의 발주서에는 변경 요청을 생성할 수 없습니다.
- 동일 발주서에 `PENDING` 변경 요청이 있으면 신규 변경 요청을 생성할 수 없습니다.
- 변경 항목은 수량 또는 납기일 중 1개 이상 필요합니다.
- 요청 수량은 현재 수량보다 커야 합니다.
- 요청 납기일은 현재 납기일보다 최소 정책 일수 이상 연장되어야 합니다.
- 승인/반려는 소싱팀(`SOURCING`)만 처리할 수 있습니다.
- 승인/반려 시 `reviewedBy`, `reviewComment`, `reviewedAt`을 기록합니다.
- 승인 시 발주서 업데이트, 변경 요청 상태 변경, History 저장은 하나의 트랜잭션으로 처리됩니다.
- 승인 처리 중 오류가 발생하면 발주서 업데이트와 변경 요청 상태 변경은 롤백됩니다.
- 반려 시 발주서와 History는 변경하지 않고 Request 상태와 검토 정보만 저장합니다.

## 테스트 실행 방법

### 단위 테스트

```bash
npm test -- --runInBand --verbose
```

### PostgreSQL e2e 테스트

로컬 PostgreSQL을 사용할 경우:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:15432/purchase_order_test?schema=public"
npm run test:e2e
```

Docker Compose DB를 사용할 경우:

```bash
export DATABASE_URL="postgresql://purchase_user:purchase_password@localhost:15433/purchase_order?schema=public"
npm run test:e2e
```

e2e 테스트는 테스트 시작 전 아래 테이블을 정리합니다.

- `histories`
- `requests`
- `orders`

## 테스트 시나리오

### 변경 저장 테스트

| 시나리오 | 검증 내용 | 테스트 위치 |
| --- | --- | --- |
| 변경 요청 승인 시 이력 저장 | 승인 후 `Order.version` 증가, `Request.status = APPROVED`, `History` 새 버전 생성 검증 | `src/requests/requests.service.spec.ts` |
| 여러 필드 동시 변경 | 수량과 납기일을 동시에 변경해도 하나의 승인 요청이 하나의 버전으로 저장되는지 검증 | `src/requests/requests.service.spec.ts`, `test/app.e2e-spec.ts` |
| 승인 트랜잭션 롤백 | History 저장 실패 시 Order/Request 변경이 롤백되는지 검증 | `test/app.e2e-spec.ts` |

### 이력 조회 테스트

| 시나리오 | 검증 내용 | 테스트 위치 |
| --- | --- | --- |
| 특정 버전 조회 | `GET /histories/{orderNo}/versions/2`가 version 2의 전체 발주서 상태를 반환하는지 검증 | `src/orders/orders.service.spec.ts`, `test/app.e2e-spec.ts` |
| 특정 시점 조회 | `GET /histories/{orderNo}/as-of?at=...`가 해당 시점에 유효한 버전을 반환하는지 검증 | `src/orders/orders.service.spec.ts`, `test/app.e2e-spec.ts` |
| 존재하지 않는 버전 조회 | 없는 버전 조회 시 `ORDER_VERSION_NOT_FOUND` 반환 검증 | `src/orders/orders.service.spec.ts` |
| 전체 변경 이력 조회 | `GET /histories`가 모든 발주서의 변경 이력을 반환하는지 검증 | `src/orders/orders.service.spec.ts`, `test/app.e2e-spec.ts` |
| 특정 발주서 변경 이력 조회 | `GET /histories/{orderNo}`가 특정 발주서의 버전 목록을 반환하는지 검증 | `src/orders/orders.service.spec.ts`, `test/app.e2e-spec.ts` |

### 변경 비교 테스트

| 시나리오 | 검증 내용 | 테스트 위치 |
| --- | --- | --- |
| 버전 간 차이 비교 | `GET /histories/{orderNo}/compare?fromVersion=1&toVersion=2`가 변경된 필드, 이전값, 이후값, 수량 delta, 납기일 deltaDays를 반환하는지 검증 | `src/orders/orders.service.spec.ts`, `test/app.e2e-spec.ts` |
| 비교 대상 버전 없음 | 비교 대상 버전이 없으면 `ORDER_VERSION_COMPARE_TARGET_NOT_FOUND` 반환 검증 | `src/orders/orders.service.spec.ts` |

### 통합 시나리오 테스트

| 시나리오 | 검증 내용 | 테스트 위치 |
| --- | --- | --- |
| 전체 플로우 | 발주 생성 -> 확정 -> 변경요청 -> 반려 -> 재요청 -> 승인 -> 이력조회 -> 특정 버전 조회 -> 특정 시점 조회 -> 버전 비교 검증 | `test/app.e2e-spec.ts` |
| 반려 플로우 | 반려 시 Order와 History가 변경되지 않고 Request에 `reviewedBy`, `reviewComment`, `reviewedAt`이 기록되는지 검증 | `test/app.e2e-spec.ts` |

## Prisma

스키마 위치:

```text
prisma/schema.prisma
```

DB 반영:

```bash
npx prisma db push --schema=prisma/schema.prisma
```

Prisma Client 생성:

```bash
npx prisma generate --schema=prisma/schema.prisma
```
