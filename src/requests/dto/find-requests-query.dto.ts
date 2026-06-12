import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../entities/request.entity';

export class FindRequestsQueryDto {
  @ApiPropertyOptional({
    example: 'PO-2025-0001',
    description: '발주서 관리번호 필터',
  })
  orderNo?: string;

  @ApiPropertyOptional({
    enum: RequestStatus,
    example: RequestStatus.REJECTED,
    description: '변경 요청 상태 필터',
  })
  status?: string;
}
