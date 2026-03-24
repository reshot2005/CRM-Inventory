import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { UserRole } from '../../../common/types/user-role.enum';
import { ERROR_CODES } from '../../../common/types/error-codes';

interface JwtStrategyPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  allowedLocations: string[];
  iat: number;
  exp: number;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const secret = configService.get<string>('app.jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtStrategyPayload): Promise<JwtPayload> {
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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_003.code,
        message: ERROR_CODES.AUTH_003.message,
      });
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      allowedLocations: payload.allowedLocations,
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti,
    };
  }
}
