import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RegisterDto, ChangePasswordDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { TwoFactorCodeDto } from './dto/verify-2fa.dto';
import { AuthResponseDto, TwoFactorRequiredDto } from './dto/auth-response.dto';
import { JwtPayload, TempJwtPayload } from '../../common/types/jwt-payload.type';
import { UserRole } from '../../common/types/user-role.enum';
import { ERROR_CODES } from '../../common/types/error-codes';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserForTokens {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  allowedLocations: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ id: string; email: string; name: string; status: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const rounds = this.configService.get<number>('app.bcryptRounds') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'STAFF',
        status: 'PENDING',
        allowedLocations: [],
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    this.logger.log(`New user registered: ${user.email} (${user.id})`);

    return user;
  }

  async login(
    dto: LoginDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<AuthResponseDto | TwoFactorRequiredDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message: ERROR_CODES.AUTH_001.message,
      });
    }

    if (user.status === 'PENDING') {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_002.code,
        message: ERROR_CODES.AUTH_002.message,
      });
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_003.code,
        message: ERROR_CODES.AUTH_003.message,
      });
    }

    if (user.status === 'REJECTED') {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_004.code,
        message: ERROR_CODES.AUTH_004.message,
        rejectionReason: user.rejectionReason,
      } as Record<string, unknown>);
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message: ERROR_CODES.AUTH_001.message,
      });
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempPayload: TempJwtPayload = {
        sub: user.id,
        email: user.email,
        type: '2fa_pending',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      };

      const tempToken = this.jwtService.sign(tempPayload, {
        secret: this.configService.get<string>('app.jwt.accessSecret'),
        expiresIn: '5m',
      });

      return { requires2FA: true, tempToken };
    }

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
      allowedLocations: user.allowedLocations,
    });

    const refreshExpires =
      this.configService.get<string>('app.jwt.refreshExpires') ?? '7d';
    const expiresAt = this.calculateExpiry(refreshExpires);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
    };
  }

  async verify2FA(
    dto: Verify2FADto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<AuthResponseDto> {
    let decoded: TempJwtPayload;
    try {
      decoded = this.jwtService.verify<TempJwtPayload>(dto.tempToken, {
        secret: this.configService.get<string>('app.jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    if (decoded.type !== '2fa_pending') {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_008.code,
        message: ERROR_CODES.AUTH_008.message,
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: dto.code,
      window: 1,
    });

    if (!verified) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_007.code,
        message: ERROR_CODES.AUTH_007.message,
      });
    }

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
      allowedLocations: user.allowedLocations,
    });

    const refreshExpires =
      this.configService.get<string>('app.jwt.refreshExpires') ?? '7d';
    const expiresAt = this.calculateExpiry(refreshExpires);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
    };
  }

  async refreshToken(
    token: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<AuthResponseDto> {
    const refreshSecret = this.configService.get<string>('app.jwt.refreshSecret');
    if (!refreshSecret) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    const rawBlacklisted = await this.redis.isRefreshTokenRawBlacklisted(token);
    if (rawBlacklisted) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    let verifiedPayload: { sub: string; jti?: string };
    try {
      verifiedPayload = this.jwtService.verify<{ sub: string; jti?: string }>(
        token,
        {
          secret: refreshSecret,
          ignoreExpiration: false,
        },
      );
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_005.code,
        message: ERROR_CODES.AUTH_005.message,
      });
    }

    if (verifiedPayload.jti) {
      const bl = await this.redis.get(`blacklist:${verifiedPayload.jti}`);
      if (bl) {
        throw new UnauthorizedException({
          code: ERROR_CODES.AUTH_006.code,
          message: ERROR_CODES.AUTH_006.message,
        });
      }
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: token },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.userSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_005.code,
        message: ERROR_CODES.AUTH_005.message,
      });
    }

    const user = session.user;

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_003.code,
        message: ERROR_CODES.AUTH_003.message,
      });
    }

    const refreshExpires =
      this.configService.get<string>('app.jwt.refreshExpires') ?? '7d';
    const ttlSeconds = Math.max(
      1,
      Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000),
    );

    if (verifiedPayload.jti) {
      await this.redis.blacklistToken(verifiedPayload.jti, ttlSeconds);
    }
    await this.redis.blacklistRefreshTokenRaw(token, ttlSeconds);

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
      allowedLocations: user.allowedLocations,
    });

    const expiresAt = this.calculateExpiry(refreshExpires);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
    });

    if (session && session.userId === userId) {
      await this.prisma.userSession.delete({ where: { id: session.id } });
    }

    try {
      const decoded = this.jwtService.verify<{ jti?: string }>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
        ignoreExpiration: true,
      });
      const refreshExpires =
        this.configService.get<string>('app.jwt.refreshExpires') ?? '7d';
      const ttl = this.parseDurationToSeconds(refreshExpires);
      if (decoded.jti) {
        await this.redis.blacklistToken(decoded.jti, ttl);
      }
      await this.redis.blacklistRefreshTokenRaw(refreshToken, ttl);
    } catch {
      // Token may already be invalid — that's fine
    }
  }

  async setup2FA(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      name: 'StockOS',
      issuer: 'StockOS',
      length: 20,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    const otpauthUrl = secret.otpauth_url ?? '';
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      otpauthUrl,
      qrCode,
    };
  }

  async enable2FA(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_008.code,
        message: 'Two-factor setup not initiated. Call setup-2fa first.',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_007.code,
        message: ERROR_CODES.AUTH_007.message,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { enabled: true };
  }

  async disable2FA(
    userId: string,
    code: string,
  ): Promise<{ disabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_008.code,
        message: 'Two-factor authentication is not enabled',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_007.code,
        message: ERROR_CODES.AUTH_007.message,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { disabled: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ changed: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message: 'User not found',
      });
    }

    const passwordValid = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message: 'Current password is incorrect',
      });
    }

    const rounds = this.configService.get<number>('app.bcryptRounds') ?? 12;
    const newHash = await bcrypt.hash(dto.newPassword, rounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
    });

    const refreshExpires =
      this.configService.get<string>('app.jwt.refreshExpires') ?? '7d';
    const sessionTtl = this.parseDurationToSeconds(refreshExpires);

    for (const session of sessions) {
      try {
        const decoded = this.jwtService.verify<{ jti?: string }>(
          session.refreshToken,
          {
            secret: this.configService.get<string>('app.jwt.refreshSecret'),
            ignoreExpiration: true,
          },
        );
        if (decoded.jti) {
          await this.redis.blacklistToken(decoded.jti, sessionTtl);
        }
      } catch {
        // Token decode failed — still blacklist raw refresh string
      }
      await this.redis.blacklistRefreshTokenRaw(
        session.refreshToken,
        sessionTtl,
      );
    }

    await this.prisma.userSession.deleteMany({ where: { userId } });

    this.logger.log(`Password changed for user ${userId}, all sessions revoked`);

    return { changed: true };
  }

  async getMe(
    userId: string,
  ): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    twoFactorEnabled: boolean;
    allowedLocations: string[];
    lastLoginAt: Date | null;
    createdAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        allowedLocations: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_006.code,
        message: ERROR_CODES.AUTH_006.message,
      });
    }

    return user;
  }

  private async generateTokens(user: UserForTokens): Promise<TokenPair> {
    const jti = crypto.randomUUID();

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      allowedLocations: user.allowedLocations,
      jti,
    };

    const accessExpires =
      this.configService.get<string>('app.jwt.accessExpires') ?? '15m';
    const refreshExpires =
      this.configService.get<string>('app.jwt.refreshExpires') ?? '7d';

    const expiresIn = this.parseDurationToSeconds(accessExpires);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('app.jwt.accessSecret'),
        expiresIn: accessExpires,
      }),
      this.jwtService.signAsync(
        { sub: user.id, jti },
        {
          secret: this.configService.get<string>('app.jwt.refreshSecret'),
          expiresIn: refreshExpires,
        },
      ),
    ]);

    return { accessToken, refreshToken, expiresIn };
  }

  private calculateExpiry(duration: string): Date {
    const seconds = this.parseDurationToSeconds(duration);
    return new Date(Date.now() + seconds * 1000);
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 604800; // default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 604800;
    }
  }
}
