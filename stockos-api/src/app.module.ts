import { join } from 'path';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './modules/users/users.module';

import { AppController } from './app.controller';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AccountStatusGuard } from './common/guards/account-status.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';

/**
 * Nest surface after Week 4 retarget:
 * - Auth (Supabase JWT sync / me / webhook)
 * - Users (admin approve/reject)
 * - Health
 * Inventory/CRM/sales/manufacturing/reports/storage removed — zero callers;
 * web app uses Supabase direct.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig, jwtConfig],
      envFilePath: join(__dirname, '..', '.env'),
    }),
    PrismaModule,
    RedisModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccountStatusGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 10,
          scope: 'auth-login',
        }),
      )
      .forRoutes({ path: 'api/v1/auth/login', method: RequestMethod.POST });

    consumer
      .apply(
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 5,
          scope: 'auth-register',
        }),
      )
      .forRoutes({
        path: 'api/v1/auth/register',
        method: RequestMethod.POST,
      });

    consumer
      .apply(
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 10,
          scope: 'auth-verify-2fa',
        }),
      )
      .forRoutes({
        path: 'api/v1/auth/verify-2fa',
        method: RequestMethod.POST,
      });

    consumer
      .apply(
        createRateLimitMiddleware({
          windowMs: 60_000,
          maxRequests: 200,
          scope: 'global',
        }),
      )
      .forRoutes('*');
  }
}
