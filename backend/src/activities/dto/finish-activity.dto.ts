import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinishActivityDto {
  @ApiPropertyOptional({ example: 'Se completó la implementación.' })
  @IsOptional()
  @IsString()
  note?: string;
}
