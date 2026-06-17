import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err: any) => {
  console.error(
    '[Redis] Connection error:',
    err instanceof Error ? err.message : String(err),
  );
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

/**
 * Cache-aside helper: returns cached value if present,
 * otherwise calls fetcher(), stores result with TTL, and returns it.
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
