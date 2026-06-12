import { ApiProperty } from '@nestjs/swagger';

export class OrderSpecificationDto {
  @ApiProperty({ example: 'white', description: '색상' })
  color: string;

  @ApiProperty({ example: 'M', description: '사이즈' })
  size: string;
}
