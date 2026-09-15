import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'DevOffice Platform' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'DVOF' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
