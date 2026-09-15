import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartActivityDto {
  @ApiProperty()
  @IsUUID()
  statusId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({ example: 'Implementación del login' })
  @IsOptional()
  @IsString()
  description?: string;
}
