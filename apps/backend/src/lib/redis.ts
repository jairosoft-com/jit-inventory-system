import { Redis } from 'ioredis';
import { env } from './env.js';

/**
 * Whether Redis is currently reachable.
 * Starts false; flips to true on first successful connect and back to false
 * on error so callers can decide whether to use Redis-backed features.
 */
export let redisReady = false;

export const redis = new Redis(env.REDIS_URL, {
  /**
   * 0 = do not retry failed commands — let them fail immediately rather than
   * queuing up and eventually throwing MaxRetriesPerRequestError which crashes
   * the process. Rate-limit stores and cacheGet both handle the rejection
   * gracefully so the server stays up when Redis is unavailable.
   */
  maxRetriesPerRequest: 0,
  lazyConnect: true,
  /**
   * Stop ioredis from auto-reconnecting forever in local dev when there is no
   * Redis instance running. After 10 attempts the error handler keeps logging
   * but the process no longer crashes.
   */
  retryStrategy: (times: number) => {
    if (times > 10) return null; // stop reconnecting
    return Math.min(times * 500, 5000);
  },
});

redis.on('error', (err: unknown) => {
  redisReady = false;
  console.error(
    '[Redis] Connection error:',
    err instanceof Error ? err.message : String(err),
  );
});

redis.on('connect', () => {
  redisReady = true;
  console.log('[Redis] Connected successfully');
});

redis.on('close', () => {
  redisReady = false;
});

/**
 * Cache-aside helper: returns cached value if present,
 * otherwise calls fetcher(), stores result with TTL, and returns it.
 * Always falls through to fetcher when Redis is unavailable.
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis down — fall through to fetcher
  }

  const result = await fetcher();

  try {
    await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
  } catch {
    // Redis down — result still returned from DB
  }

  return result;
}