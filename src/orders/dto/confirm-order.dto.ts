import { ApiProperty } from '@nestjs/swagger';
import { ActorRole } from '../../common/entities/actor-role.entity';

export class ConfirmOrderDto {
  @ApiProperty({ example: 'sourcing-user', description: '확정 처리자' })
  confirmedBy: string;

  @ApiProperty({
    enum: ActorRole,
    example: ActorRole.SOURCING,
    description: '요청자 역할. SOURCING만 확정 가능',
  })
  actorRole: ActorRole;
}
