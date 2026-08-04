import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { decode } from 'jsonwebtoken';
import { ExtractJwt, Strategy, StrategyOptionsWithSecret } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { AuthService } from '../auth.service';
import {
  AccountStatus,
  JwtPayload,
} from '../../../common/types/jwt-payload.type';
import { UserRole } from '../../../common/types/user-role.enum';
import { ERROR_CODES } from '../../../common/types/error-codes';
import { registrationProfileFromMetadata } from '../utils/registration-profile.util';
import {
  getSupabaseJwksPublicKeyPem,
  isSupabaseUserAccessPayload,
} from '../utils/supabase-jwt.util';

interface AppAccessJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  allowedLocations: string[];
  iat: number;
  exp: number;
  jti: string;
}

async function resolveVerificationKey(
  rawToken: string,
  configService: ConfigService,
): Promise<string | Buffer> {
  const appSecret = configService.get<string>('app.jwt.accessSecret');
  if (!appSecret) {
    throw new Error('JWT_ACCESS_SECRET is not configured');
  }

  const supabaseUrl = configService.get<string>('app.supabase.url');
  const supabaseJwtSecret =
    configService.get<string>('app.supabase.jwtSecret') ?? undefined;

  const decoded = decode(rawToken, { complete: true });
  if (
    !decoded ||
    typeof decoded === 'string' ||
    !decoded.header ||
    typeof decoded.payload !== 'object' ||
    decoded.payload === null
  ) {
    return appSecret;
  }

  const header = decoded.header as unknown as Record<string, unknown>;
  const payload = decoded.payload as Record<string, unknown>;
  const alg = typeof header['alg'] === 'string' ? header['alg'] : '';
  const kid = typeof header['kid'] === 'string' ? header['kid'] : '';

  if (supabaseUrl && isSupabaseUserAccessPayload(payload, supabaseUrl)) {
    if (alg === 'ES256' || alg === 'RS256') {
      if (!kid) {
        throw new Error(
          'Supabase access token is asymmetric (ES256/RS256) but the JWT header has no kid',
        );
      }
      return getSupabaseJwksPublicKeyPem(supabaseUrl, kid);
    }
    if (alg === 'HS256' && supabaseJwtSecret) {
      return supabaseJwtSecret;
    }
    if (alg === 'HS256' && !supabaseJwtSecret) {
      throw new Error(
        'Supabase access token is HS256 but SUPABASE_JWT_SECRET is not set. Add the legacy JWT secret from Project Settings → API → JWT Settings.',
      );
    }
  }

  return appSecret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256', 'RS256'],
      secretOrKeyProvider: (
        _request: Request,
        rawJwtToken: string,
        done: (err: Error | null, secret?: string | Buffer) => void,
      ) => {
        void resolveVerificationKey(rawJwtToken, this.configService)
          .then((key) => done(null, key))
          .catch((err: unknown) =>
            done(err instanceof Error ? err : new Error(String(err))),
          );
      },
    } as StrategyOptionsWithSecret);
  }

  async validate(
    payload: AppAccessJwtPayload | Record<string, unknown>,
  ): Promise<JwtPayload> {
    const p = payload as Record<string, unknown>;
    const supabaseUrl = this.configService.get<string>('app.supabase.url');

    if (isSupabaseUserAccessPayload(p, supabaseUrl)) {
      return this.validateSupabaseAccessToken(p);
    }

    return this.validateAppAccessToken(payload as AppAccessJwtPayload);
  }

  private async validateAppAccessToken(
    payload: AppAccessJwtPayload,
  ): Promise<JwtPayload> {
    if (payload.jti) {
      const revoked = await this.redis.get(`blacklist:${payload.jti}`);
      if (revoked) {
        throw new UnauthorizedException({
          code: ERROR_CODES.AUTH_006.code,
          message: ERROR_CODES.AUTH_006.message,
        });
      }

      const isBlacklisted = await this.redis.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException({
          code: ERROR_CODES.AUTH_006.code,
          message: ERROR_CODES.AUTH_006.message,
        });
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        companyName: true,
        jobTitle: true,
        role: true,
        status: true,
        allowedLocations: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      companyName: user.companyName,
      jobTitle: user.jobTitle,
      role: user.role as UserRole,
      allowedLocations: user.allowedLocations,
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti,
      accountStatus: user.status as AccountStatus,
    };
  }

  private async validateSupabaseAccessToken(
    payload: Record<string, unknown>,
  ): Promise<JwtPayload> {
    const supabaseUserId = String(payload['sub'] ?? '');
    const email = String(payload['email'] ?? '');
    const meta = payload['user_metadata'] as Record<string, unknown> | undefined;
    const profile = registrationProfileFromMetadata(meta, email);

    const user = await this.authService.syncUserFromSupabase(
      supabaseUserId,
      email,
      profile,
    );

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      companyName: user.companyName,
      jobTitle: user.jobTitle,
      role: user.role as UserRole,
      allowedLocations: user.allowedLocations,
      iat: Number(payload['iat']),
      exp: Number(payload['exp']),
      accountStatus: user.status as AccountStatus,
      supabaseSub: supabaseUserId,
    };
  }
}
