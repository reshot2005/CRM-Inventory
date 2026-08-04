import { UserRole } from './user-role.enum';

export type AccountStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED';

export interface JwtPayload {
  /** Application user id (internal `users.id`) */
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  allowedLocations: string[];
  iat: number;
  exp: number;
  /** Present for app-issued access tokens; omitted for Supabase access tokens */
  jti?: string;
  accountStatus: AccountStatus;
  /** When the access token was issued by Supabase, original `sub` (auth user id) */
  supabaseSub?: string;
  /** From Supabase `user_metadata` or DB — used to sync profile on /auth/sync */
  phone?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
}

export interface TempJwtPayload {
  sub: string;
  email: string;
  type: '2fa_pending';
  iat: number;
  exp: number;
}
