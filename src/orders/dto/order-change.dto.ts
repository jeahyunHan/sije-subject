export class OrderChangeDto {
  quantity?: number;
  dueDate?: string;
}

export type OrderChangeField = keyof OrderChangeDto;
