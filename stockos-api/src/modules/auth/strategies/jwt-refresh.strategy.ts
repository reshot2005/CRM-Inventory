import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

interface RefreshPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

function extractRefreshFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  if (cookies && cookies['refresh_token']) {
    return cookies['refresh_token'];
  }
  return null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('app.jwt.refreshSecret');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: extractRefreshFromCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: RefreshPayload,
  ): Promise<{ sub: string; refreshToken: string }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.['refresh_token'];

    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'AUTH_003',
        message: 'Refresh token not found',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'AUTH_005',
        message: 'Account is not active',
      });
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'AUTH_003',
        message: 'Refresh session expired or not found',
      });
    }

    return { sub: payload.sub, refreshToken };
  }
}
