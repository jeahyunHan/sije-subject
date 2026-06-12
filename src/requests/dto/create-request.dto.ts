import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorRole } from '../../common/entities/actor-role.entity';

export class CreateRequestDto {
  @ApiProperty({ example: 'PO-2026-000001', description: '발주서 관리번호' })
  orderNo: string;

  @ApiProperty({ example: '수량 증가 및 납기 연장', description: '변경 사유' })
  reason: string;

  @ApiPropertyOptional({ example: 1500, description: '변경 요청 수량' })
  requestedQuantity?: number;

  @ApiPropertyOptional({
    example: '2025-03-25',
    description: '변경 요청 납기일',
  })
  requestedDueDate?: string;

  @ApiProperty({ example: 'buyer-user', description: '변경 요청자' })
  requestedBy: string;

  @ApiProperty({
    enum: ActorRole,
    example: ActorRole.BUYER,
    description: '요청자 역할. BUYER만 변경 요청 생성 가능',
  })
  actorRole: ActorRole;
}
