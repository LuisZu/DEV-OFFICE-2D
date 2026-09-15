import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@devoffice.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe#Admin1' })
  @IsString()
  @MinLength(1)
  password: string;
}
