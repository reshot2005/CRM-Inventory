import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token (can also be sent via cookie)' })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
