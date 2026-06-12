export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class Request {
  id: string;
  orderNo: string;
  reason: string;
  requestedQuantity: number | null;
  requestedDueDate: Date | null;
  requestedBy: string;
  reviewedBy: string | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
}
