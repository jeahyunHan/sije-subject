export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  COMPLETED = 'COMPLETED',
}

export interface OrderSpecification {
  color: string;
  size: string;
}

export interface OrderSnapshot {
  orderNo: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  specification: OrderSpecification;
  dueDate: Date;
  status: OrderStatus;
  version: number;
  createdBy: string;
}

export interface OrderChangedField<T = unknown> {
  from: T;
  to: T;
}

export type ChangeableOrderField =
  | 'productName'
  | 'quantity'
  | 'unitPrice'
  | 'specification'
  | 'dueDate'
  | 'status';

export type OrderChangeSet = Partial<
  Record<ChangeableOrderField, OrderChangedField>
>;

export class Order {
  id: string;
  orderNo: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  specification: OrderSpecification;
  dueDate: Date;
  status: OrderStatus;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class History {
  id: string;
  orderNo: string;
  requestId: string | null;
  version: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  specification: OrderSpecification;
  dueDate: Date;
  status: OrderStatus;
  createdBy: string;
  changedFields: OrderChangeSet | null;
  approvedBy: string | null;
  effectiveAt: Date;
  createdAt: Date;
}
