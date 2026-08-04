import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SUPABASE_CLIENT } from '../../config/supabase.config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RegisterDto, ChangePasswordDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { AuthResponseDto, TwoFactorRequiredDto } from './dto/auth-response.dto';
import { AdminCreateSupabaseUserDto } from './dto/admin-create-supabase-user.dto';
import {
  AccountStatus,
  JwtPayload,
  TempJwtPayload,
} from '../../common/types/jwt-payload.type';
import {
  ROLE_PERMISSIONS,
  UserRole,
} from '../../common/types/user-role.enum';
import { ERROR_CODES } from '../../common/types/error-codes';
import { type RegistrationProfile } from './utils/registration-profile.util';

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
  status: AccountStatus;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    @Optional()
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient | null,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ id: string; email: string; name: string; status: string }> {
    if (this.configService.get<string>('app.supabase.url')) {
      throw new GoneException({
        message:
          'Registration is handled client-side via Supabase Auth SDK. Use the web app to sign up.',
        code: 'AUTH_REGISTER_DEPRECATED',
      });
    }

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
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        companyName: dto.companyName?.trim() || null,
        jobTitle: dto.jobTitle?.trim() || null,
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

    if (!user.passwordHash) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message:
          'This account signs in with Supabase. Use the web app or Supabase-backed login.',
      });
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
      status: user.status as AccountStatus,
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
      status: user.status as AccountStatus,
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
      status: user.status as AccountStatus,
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
      select: {
        id: true,
        passwordHash: true,
        email: true,
        supabaseId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message: 'User not found',
      });
    }

    if (!user.passwordHash) {
      await this.changePasswordViaSupabase(user, dto);
      await this.revokeAllSessionsAfterPasswordChange(userId);
      this.logger.log(
        `Password changed via Supabase for user ${userId}, all sessions revoked`,
      );
      return { changed: true };
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

    await this.revokeAllSessionsAfterPasswordChange(userId);

    this.logger.log(`Password changed for user ${userId}, all sessions revoked`);

    return { changed: true };
  }

  async getMe(
    userId: string,
  ): Promise<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    companyName: string | null;
    jobTitle: string | null;
    role: string;
    status: string;
    twoFactorEnabled: boolean;
    allowedLocations: string[];
    lastLoginAt: Date | null;
    createdAt: Date;
    permissions: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        companyName: true,
        jobTitle: true,
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

    return {
      ...user,
      permissions: ROLE_PERMISSIONS[user.role as UserRole] ?? [],
    };
  }

  async syncUserFromSupabase(
    supabaseId: string,
    email: string,
    profile: RegistrationProfile,
  ): Promise<User> {
    const existingBySupabase = await this.prisma.user.findUnique({
      where: { supabaseId },
    });

    if (existingBySupabase) {
      const patch: Prisma.UserUpdateInput = {};
      if (existingBySupabase.email !== email) {
        patch.email = email;
      }
      if (existingBySupabase.name !== profile.name) {
        patch.name = profile.name;
      }
      if ((existingBySupabase.phone ?? null) !== (profile.phone ?? null)) {
        patch.phone = profile.phone;
      }
      if (
        (existingBySupabase.companyName ?? null) !==
        (profile.companyName ?? null)
      ) {
        patch.companyName = profile.companyName;
      }
      if ((existingBySupabase.jobTitle ?? null) !== (profile.jobTitle ?? null)) {
        patch.jobTitle = profile.jobTitle;
      }
      if (Object.keys(patch).length > 0) {
        return this.prisma.user.update({
          where: { id: existingBySupabase.id },
          data: patch,
        });
      }
      return existingBySupabase;
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          supabaseId,
          name: profile.name,
          phone: profile.phone,
          companyName: profile.companyName,
          jobTitle: profile.jobTitle,
        },
      });
    }

    const autoApprove = this.configService.get<boolean>(
      'app.supabase.autoApproveSignups',
    );
    const initialStatus = autoApprove ? 'ACTIVE' : 'PENDING';

    return this.prisma.user.create({
      data: {
        supabaseId,
        email,
        name: profile.name,
        phone: profile.phone,
        companyName: profile.companyName,
        jobTitle: profile.jobTitle,
        passwordHash: null,
        role: 'STAFF',
        status: initialStatus,
        allowedLocations: [],
      },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /** Sync approval state to Supabase Auth user_metadata (optional). */
  async notifySupabaseUserApproved(supabaseId: string | null): Promise<void> {
    if (!supabaseId || !this.supabase) {
      return;
    }
    const { error } = await this.supabase.auth.admin.updateUserById(
      supabaseId,
      {
        user_metadata: { status: 'ACTIVE', approved: true },
      },
    );
    if (error) {
      this.logger.warn(
        `Supabase updateUserById failed for ${supabaseId}: ${error.message}`,
      );
    }
  }

  async adminCreateSupabaseUser(
    dto: AdminCreateSupabaseUserDto,
    adminId: string,
  ): Promise<User> {
    if (!this.supabase) {
      throw new BadRequestException(
        'Supabase is not configured on this server',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const { data, error } = await this.supabase.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: { name: dto.name },
    });

    if (error || !data.user) {
      throw new BadRequestException(
        error?.message ?? 'Failed to create Supabase user',
      );
    }

    const role = dto.role ?? 'STAFF';
    const allowedLocations = dto.allowedLocations ?? [];

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          supabaseId: data.user.id,
          email: dto.email,
          name: dto.name,
          passwordHash: null,
          role,
          status: 'ACTIVE',
          allowedLocations,
        },
      });

      return created;
    });

    this.logger.log(
      `Admin ${adminId} created Supabase-linked user ${user.email} (${user.id})`,
    );

    return user;
  }

  async adminRevokeSupabaseUser(
    adminId: string,
    targetUserId: string,
  ): Promise<{ suspended: boolean }> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    if (target.supabaseId && this.supabase) {
      const { error } = await this.supabase.auth.admin.deleteUser(
        target.supabaseId,
      );
      if (error) {
        this.logger.warn(
          `Supabase deleteUser failed for ${target.supabaseId}: ${error.message}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId: targetUserId } });
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          status: 'SUSPENDED',
          supabaseId: null,
        },
      });
    });

    return { suspended: true };
  }

  private async changePasswordViaSupabase(
    user: {
      id: string;
      email: string;
      supabaseId: string | null;
    },
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (!user.supabaseId) {
      throw new BadRequestException(
        'This account has no linked Supabase identity; set a password in the database or contact support.',
      );
    }

    const url = this.configService.get<string>('app.supabase.url');
    const anonKey = this.configService.get<string>('app.supabase.anonKey');
    if (!url || !anonKey || !this.supabase) {
      throw new BadRequestException(
        'Supabase is not fully configured (need URL, anon key, and service role)',
      );
    }

    const anonClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: signErr } = await anonClient.auth.signInWithPassword({
      email: user.email,
      password: dto.oldPassword,
    });

    if (signErr) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_001.code,
        message: 'Current password is incorrect',
      });
    }

    const { error: updateErr } = await this.supabase.auth.admin.updateUserById(
      user.supabaseId,
      { password: dto.newPassword },
    );

    if (updateErr) {
      throw new BadRequestException(updateErr.message);
    }
  }

  private async revokeAllSessionsAfterPasswordChange(userId: string): Promise<void> {
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
      accountStatus: user.status,
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
