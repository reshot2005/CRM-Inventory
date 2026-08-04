import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { Public } from './common/decorators/public.decorator';

interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  database: 'connected' | 'error';
  redis: 'connected' | 'error';
  supabase: 'connected' | 'not_configured';
  uptime: number;
  timestamp: string;
  version: string;
}

@Controller()
@ApiTags('health')
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  async healthCheck(): Promise<HealthCheckResponse> {
    const uptimeSeconds = process.uptime();
    let dbStatus: 'connected' | 'error' = 'connected';
    let redisStatus: 'connected' | 'error' = 'connected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    try {
      const pong = await this.redis.ping();
      redisStatus = pong ? 'connected' : 'error';
    } catch {
      redisStatus = 'error';
    }

    const status: HealthCheckResponse['status'] =
      dbStatus === 'connected' && redisStatus === 'connected'
        ? 'ok'
        : dbStatus === 'error' && redisStatus === 'error'
          ? 'down'
          : 'degraded';

    const supabaseUrl = this.configService.get<string>('app.supabase.url');
    const supabaseStatus: HealthCheckResponse['supabase'] = supabaseUrl
      ? 'connected'
      : 'not_configured';

    return {
      status,
      database: dbStatus,
      redis: redisStatus,
      supabase: supabaseStatus,
      uptime: Math.floor(uptimeSeconds),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
