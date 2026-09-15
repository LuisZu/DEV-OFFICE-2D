import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'If omitted, all active sessions for the user are revoked.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
