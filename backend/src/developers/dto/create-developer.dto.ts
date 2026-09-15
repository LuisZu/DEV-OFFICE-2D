import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateDeveloperDto {
  @ApiProperty({ example: 'new.developer@devoffice.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe#1234' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Laura' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Fernández' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
