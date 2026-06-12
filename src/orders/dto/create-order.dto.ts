import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorRole } from '../../common/entities/actor-role.entity';
import { OrderStatus } from '../entities/order.entity';
import { OrderSpecificationDto } from './order-specification.dto';

export class CreateOrderDto {
  @ApiProperty({ example: '티셔츠', description: '상품명' })
  productName: string;

  @ApiProperty({ example: 1000, description: '발주 수량' })
  quantity: number;

  @ApiProperty({ example: 5000, description: '단가' })
  unitPrice: number;

  @ApiProperty({ type: OrderSpecificationDto, description: '사양 정보 JSON' })
  specification: OrderSpecificationDto;

  @ApiProperty({ example: '2025-03-15', description: '납기일' })
  dueDate: string;

  @ApiProperty({ example: 'buyer-user', description: '발주서 생성자' })
  createdBy: string;

  @ApiProperty({
    enum: ActorRole,
    example: ActorRole.BUYER,
    description: '요청자 역할. BUYER만 발주서 생성 가능',
  })
  actorRole: ActorRole;

  @ApiPropertyOptional({
    enum: [OrderStatus.DRAFT, OrderStatus.PENDING],
    example: OrderStatus.PENDING,
    description: '생성 상태. 미지정 시 DRAFT',
  })
  status?: OrderStatus.DRAFT | OrderStatus.PENDING;
}
