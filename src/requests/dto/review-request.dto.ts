import { ApiProperty } from '@nestjs/swagger';
import { ActorRole } from '../../common/entities/actor-role.entity';

export class ReviewRequestDto {
  @ApiProperty({ example: 'sourcing-user', description: '검토자' })
  reviewedBy: string;

  @ApiProperty({ example: '생산 가능', description: '검토 의견' })
  reviewComment: string;

  @ApiProperty({
    enum: ActorRole,
    example: ActorRole.SOURCING,
    description: '요청자 역할. SOURCING만 승인/반려 가능',
  })
  actorRole: ActorRole;
}
