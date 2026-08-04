/**
 * BUG-4: Rate-limit middleware must fail open / fail fast when Redis is down.
 * Run from stockos-api: npx ts-node --transpile-only scripts/test-rate-limit-failopen.ts
 */
import { performance } from 'perf_hooks';
import type { Request, Response, NextFunction } from 'express';
import {
  RateLimitMiddleware,
  RATE_LIMIT_REDIS_TIMEOUT_MS,
  resetRateLimitCircuit,
  getRateLimitCircuit,
} from '../src/common/middleware/rate-limit.middleware';

class HangingRedis {
  incr(_key: string): Promise<number> {
    return new Promise(() => {
      /* never resolves — simulates unreachable Redis */
    });
  }
  expire(_key: string, _ttl: number): Promise<number> {
    return new Promise(() => {});
  }
}

class FailingRedis {
  incr(_key: string): Promise<number> {
    return Promise.reject(new Error('ECONNREFUSED'));
  }
  expire(_key: string, _ttl: number): Promise<number> {
    return Promise.reject(new Error('ECONNREFUSED'));
  }
}

function mockReqRes(): { req: Request; res: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const req = {
    ip: '127.0.0.1',
    headers: {},
  } as unknown as Request;
  const res = {
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status() {
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  return { req, res, headers };
}

async function runCase(
  name: string,
  redis: unknown,
  maxMs: number,
): Promise<void> {
  resetRateLimitCircuit();
  const mw = new RateLimitMiddleware(redis as never, {
    windowMs: 60_000,
    maxRequests: 200,
    scope: 'test',
  });
  const { req, res } = mockReqRes();
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    };
    void mw.use(req, res, next);
  });
  const elapsed = performance.now() - t0;
  if (elapsed > maxMs) {
    throw new Error(`${name}: took ${elapsed.toFixed(0)}ms > ${maxMs}ms SLA`);
  }
  console.log(`PASS  ${name} — ${elapsed.toFixed(0)}ms (SLA ≤${maxMs}ms)`);
}

async function main() {
  const sla = Math.max(2000, RATE_LIMIT_REDIS_TIMEOUT_MS * 3);

  await runCase('null redis fail-open', null, 200);
  await runCase('ECONNREFUSED fail-open', new FailingRedis(), sla);
  await runCase('hanging redis timeout fail-open', new HangingRedis(), sla);

  // Do NOT reset — circuit must still be open from the hanging call.
  const circuit = getRateLimitCircuit();
  if (circuit.openUntil <= Date.now()) {
    throw new Error('Expected circuit to be open after Redis failures');
  }

  const mw = new RateLimitMiddleware(new HangingRedis() as never, {
    windowMs: 60_000,
    maxRequests: 200,
    scope: 'test',
  });
  const { req, res } = mockReqRes();
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const next: NextFunction = (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    };
    void mw.use(req, res, next);
  });
  const elapsed = performance.now() - t0;
  if (elapsed > 200) {
    throw new Error(
      `open circuit skips redis: took ${elapsed.toFixed(0)}ms > 200ms SLA`,
    );
  }
  console.log(`PASS  open circuit skips redis — ${elapsed.toFixed(0)}ms (SLA ≤200ms)`);

  console.log('All rate-limit fail-open checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
