import { UserRole } from './user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  allowedLocations: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface TempJwtPayload {
  sub: string;
  email: string;
  type: '2fa_pending';
  iat: number;
  exp: number;
}
