import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis, redisReady } from '../lib/redis.js';
import { env } from '../lib/env.js';

const windowMs = 15 * 60 * 1000; // 15 minutes

/**
 * Returns a RedisStore for the given prefix when Redis is up, otherwise
 * returns undefined so express-rate-limit falls back to its built-in
 * MemoryStore.  This prevents MaxRetriesPerRequestError from crashing the
 * process when there is no Redis instance (e.g. local dev without Docker).
 */
function createStore(prefix: string): RedisStore | undefined {
  if (!redisReady) {
    console.warn(
      `[RateLimit] Redis unavailable — falling back to MemoryStore for prefix "${prefix}"`,
    );
    return undefined;
  }
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (redis as any).call(args[0], ...args.slice(1)) as Promise<any>,
    prefix: `rl:${prefix}:`,
  });
}

// Bucket 1: Global / Core API — catch-all for all /api routes
export const globalLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_GLOBAL,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('global'),
});

// Bucket 2: Mutative / Transaction — POST/PATCH/DELETE on data routes
export const mutativeLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_MUTATIVE,
  message: { message: 'Too many write operations, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('mutative'),
  // Only count mutative HTTP methods
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
});

// Bucket 3: Authentication — brute-force protection
export const authLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_AUTH,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
});

// Bucket 4: Heavy Aggregation / Reports — expensive DB queries
export const heavyLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_HEAVY,
  message: { message: 'Too many report requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('heavy'),
});
