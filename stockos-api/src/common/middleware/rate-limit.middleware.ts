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

/** Hard ceiling for Redis round-trip so auth never stalls on infra outage. */
export const RATE_LIMIT_REDIS_TIMEOUT_MS = 500;

/** After an open circuit, skip Redis for this long. */
export const RATE_LIMIT_CIRCUIT_OPEN_MS = 30_000;

export type RedisCircuitState = {
  openUntil: number;
  consecutiveFailures: number;
};

const circuit: RedisCircuitState = {
  openUntil: 0,
  consecutiveFailures: 0,
};

/** Test/ops hook — reset circuit between unit tests. */
export function resetRateLimitCircuit(): void {
  circuit.openUntil = 0;
  circuit.consecutiveFailures = 0;
}

export function getRateLimitCircuit(): Readonly<RedisCircuitState> {
  return { ...circuit };
}

function openCircuit(logger: Logger, reason: string): void {
  circuit.consecutiveFailures += 1;
  circuit.openUntil = Date.now() + RATE_LIMIT_CIRCUIT_OPEN_MS;
  logger.error(
    `Rate-limit Redis unavailable (${reason}); circuit OPEN for ${RATE_LIMIT_CIRCUIT_OPEN_MS}ms (failures=${circuit.consecutiveFailures})`,
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Redis command timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly redis: Redis | null,
    private readonly config: RateLimitConfig,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.redis || Date.now() < circuit.openUntil) {
      if (!this.redis) {
        this.logger.warn(
          'Rate limit fail-open: Redis client not available',
        );
      }
      next();
      return;
    }

    const wallMinute = Math.floor(Date.now() / 60_000);
    const ip = this.clientIp(req);
    const userId = this.bearerSub(req);

    const key = userId
      ? `rl:user:${userId}:${wallMinute}:${this.config.scope}`
      : `rl:ip:${ip}:${wallMinute}:${this.config.scope}`;

    try {
      const count = await withTimeout(
        this.redis.incr(key),
        RATE_LIMIT_REDIS_TIMEOUT_MS,
      );
      if (count === 1) {
        // Fire-and-forget expire; do not block the request.
        void withTimeout(
          this.redis.expire(key, 120),
          RATE_LIMIT_REDIS_TIMEOUT_MS,
        ).catch((err: unknown) => {
          this.logger.warn(
            `Rate limit expire failed: ${err instanceof Error ? err.message : 'Unknown'}`,
          );
        });
      }

      circuit.consecutiveFailures = 0;

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
      openCircuit(
        this.logger,
        error instanceof Error ? error.message : 'Unknown error',
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
let sharedRedisInitFailed = false;

function getOrCreateRedis(): Redis | null {
  if (sharedRedisInitFailed) {
    return null;
  }
  if (!sharedRedis) {
    try {
      sharedRedis = new Redis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        {
          maxRetriesPerRequest: 1,
          connectTimeout: RATE_LIMIT_REDIS_TIMEOUT_MS,
          commandTimeout: RATE_LIMIT_REDIS_TIMEOUT_MS,
          lazyConnect: true,
          enableOfflineQueue: false,
          retryStrategy(times: number): number | null {
            if (times > 1) {
              return null;
            }
            return 100;
          },
        },
      );
      sharedRedis.on('error', (err: Error) => {
        // Prevent unhandled error spam; circuit breaker handles fail-open.
        Logger.warn(
          `Rate-limit Redis error: ${err.message}`,
          RateLimitMiddleware.name,
        );
      });
    } catch {
      sharedRedisInitFailed = true;
      return null;
    }
  }
  return sharedRedis;
}

/** Test hook to inject a mock Redis (or null). */
export function setSharedRateLimitRedisForTests(
  client: Redis | null,
): void {
  sharedRedis = client;
  sharedRedisInitFailed = client === null;
}

export function createRateLimitMiddleware(
  partial: Partial<RateLimitConfig> = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const config = { ...DEFAULT_CONFIG, ...partial };
  const redis = getOrCreateRedis();
  const instance = new RateLimitMiddleware(redis, config);
  return (req, res, next) => instance.use(req, res, next);
}
