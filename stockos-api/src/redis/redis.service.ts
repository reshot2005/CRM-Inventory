import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

/** Access / refresh JWT jti revocation: `blacklist:{jti}` */
const TOKEN_BLACKLIST_PREFIX = 'blacklist:';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl =
      this.configService.get<string>('app.redis.url') ||
      'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number): number | null {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connection established');
      });

      this.client.on('error', (err: Error) => {
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.logger.log('Redis connection closed');
      });

      await this.client.connect();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to connect to Redis: ${message}. Continuing without Redis — cache operations will be no-ops.`,
      );
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.logger.log('Redis disconnected');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, ttlSeconds);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.set(`${TOKEN_BLACKLIST_PREFIX}${jti}`, '1', ttlSeconds);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const v = await this.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
    return v !== null && v !== undefined;
  }

  /** Raw refresh token replay protection: blacklist:refresh:{sha256(token)} */
  refreshTokenFingerprint(token: string): string {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  }

  async blacklistRefreshTokenRaw(
    token: string,
    ttlSeconds: number,
  ): Promise<void> {
    const fp = this.refreshTokenFingerprint(token);
    await this.set(`blacklist:refresh:${fp}`, '1', ttlSeconds);
  }

  async isRefreshTokenRawBlacklisted(token: string): Promise<boolean> {
    const fp = this.refreshTokenFingerprint(token);
    return this.exists(`blacklist:refresh:${fp}`);
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const r = await this.client.ping();
      return r === 'PONG';
    } catch {
      return false;
    }
  }
}
