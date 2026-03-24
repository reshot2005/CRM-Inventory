import {
  HttpStatus,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  /**
   * Bucket id — keeps login/register/global limits independent for the same IP.
   * Combined with wall-clock minute in Redis key (INCR + EXPIRE).
   */
  scope: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 200,
  scope: 'global',
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly redis: Redis,
    private readonly config: RateLimitConfig,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const wallMinute = Math.floor(Date.now() / 60_000);
    const ip = this.clientIp(req);
    const userId = this.bearerSub(req);

    const key = userId
      ? `rl:user:${userId}:${wallMinute}:${this.config.scope}`
      : `rl:ip:${ip}:${wallMinute}:${this.config.scope}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, 120);
      }

      const remaining = Math.max(0, this.config.maxRequests - count);
      const resetAtSec = (wallMinute + 1) * 60;

      res.setHeader('X-RateLimit-Limit', String(this.config.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(resetAtSec));

      if (count > this.config.maxRequests) {
        const retryAfter = Math.max(
          1,
          resetAtSec - Math.floor(Date.now() / 1000),
        );
        res.setHeader('Retry-After', String(retryAfter));
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Retry after ${retryAfter}s.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      this.logger.error(
        `Rate limit check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      next();
    }
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
    }
    return req.ip || 'unknown';
  }

  /** Unverified JWT decode — used only for per-user rate bucket. */
  private bearerSub(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return null;
    }
    const token = auth.slice(7).trim();
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return null;
    }
    try {
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );
      const json = JSON.parse(
        Buffer.from(padded, 'base64').toString('utf8'),
      ) as { sub?: string };
      return typeof json.sub === 'string' ? json.sub : null;
    } catch {
      return null;
    }
  }
}

let sharedRedis: Redis | null = null;

function getOrCreateRedis(): Redis {
  if (!sharedRedis) {
    sharedRedis = new Redis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      { maxRetriesPerRequest: 3, lazyConnect: false },
    );
  }
  return sharedRedis;
}

export function createRateLimitMiddleware(
  partial: Partial<RateLimitConfig> = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const config = { ...DEFAULT_CONFIG, ...partial };
  const redis = getOrCreateRedis();
  const instance = new RateLimitMiddleware(redis, config);
  return (req, res, next) => instance.use(req, res, next);
}
