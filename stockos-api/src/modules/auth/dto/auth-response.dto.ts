import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../common/types/user-role.enum';

export class AuthUserDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'User full name' })
  name: string;

  @ApiProperty({ enum: UserRole, description: 'User role' })
  role: UserRole;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({ type: AuthUserDto, description: 'Authenticated user info' })
  user: AuthUserDto;
}

export class TwoFactorRequiredDto {
  @ApiProperty({ example: true, description: 'Indicates 2FA is required' })
  requires2FA: boolean;

  @ApiProperty({ description: 'Temporary token to use for 2FA verification' })
  tempToken: string;
}
