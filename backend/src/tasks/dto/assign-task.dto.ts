import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class AssignTaskDto {
  @ApiProperty({
    nullable: true,
    description: 'Developer id to assign, or null to unassign.',
  })
  @ValidateIf((dto: AssignTaskDto) => dto.developerId !== null)
  @IsUUID()
  developerId: string | null;
}
