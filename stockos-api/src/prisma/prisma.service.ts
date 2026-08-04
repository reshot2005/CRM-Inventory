import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('P1001') || msg.includes("Can't reach database")) {
        this.logger.error(
          'Prisma cannot reach Postgres (P1001). Supabase direct host db.<ref>.supabase.co is often IPv6-only; many Windows networks cannot route to it.',
        );
        this.logger.error(
          'Fix: Supabase Dashboard → Connect → copy Transaction pooler URI into DATABASE_URL (?pgbouncer=true) and Session pooler URI into DIRECT_DATABASE_URL. Resume the project if paused. See stockos-api/.env.example.',
        );
      }
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
