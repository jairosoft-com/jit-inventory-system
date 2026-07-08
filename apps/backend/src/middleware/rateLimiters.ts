import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis, redisReady } from '../lib/redis.js';
import { env } from '../lib/env.js';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

const windowMs = 15 * 60 * 1000; // 15 minutes

/**
 * Generates a rate limit key.
 * Uses the authenticated user's ID from the JWT token if present;
 * falls back to the client IP address.
 */
function getRateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        sub?: string | number;
      };
      if (decoded?.sub) {
        return `user:${decoded.sub}`;
      }
    } catch {
      // Expired or malformed token: fall back to IP rate limiting
    }
  }
  return req.ip || '';
}

/**
 * Returns a RedisStore for the given prefix when Redis is up, otherwise
 * returns undefined so express-rate-limit falls back to its built-in
 * MemoryStore.  This prevents MaxRetriesPerRequestError from crashing the
 * process when there is no Redis instance (e.g. local dev without Docker).
 */
function createStore(prefix: string): RedisStore | undefined {
  if (
    !redisReady &&
    redis.status !== 'connecting' &&
    redis.status !== 'connect'
  ) {
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
  keyGenerator: getRateLimitKey,
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
  keyGenerator: getRateLimitKey,
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
// Bucket 3b: Login — real brute-force protection. Only mounted on
// POST /auth/login. Keyed by IP + email together (falling back to IP alone
// when no email is present) so that one person mistyping their password
// repeatedly can't lock every other user on the same network/NAT out of
// logging in — a real problem on shared office/school connections where
// many users share one public IP.
export const authLoginLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_AUTH_LOGIN,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth-login'),
  keyGenerator: (req: Request) => {
    const body = req.body as Record<string, unknown> | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const ipKey = req.ip ?? 'unknown';
    return email ? `${ipKey}:${email}` : ipKey;
  },
});

// Bucket 4: Heavy Aggregation / Reports — expensive DB queries
export const heavyLimiter = rateLimit({
  windowMs,
  max: env.RATE_LIMIT_HEAVY,
  message: { message: 'Too many report requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('heavy'),
  keyGenerator: getRateLimitKey,
});
