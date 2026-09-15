import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class ChangeStatusDto {
  @ApiProperty()
  @IsUUID()
  statusId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((dto: ChangeStatusDto) => dto.taskId !== null)
  @IsUUID()
  taskId?: string | null;

  @ApiPropertyOptional({ example: 'Entrando a reunión' })
  @IsOptional()
  @IsString()
  description?: string;
}
