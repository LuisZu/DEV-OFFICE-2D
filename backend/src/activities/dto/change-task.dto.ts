import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class ChangeTaskDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'New task id, or null to keep working without a task.',
  })
  @ValidateIf((dto: ChangeTaskDto) => dto.taskId !== null)
  @IsUUID()
  taskId: string | null;
}
