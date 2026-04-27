import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Lazy initialize to avoid crashing if env vars are missing during build/startup
let redisClient: Redis;
let ratelimitClient: Ratelimit;

export const getRedisClient = () => {
  if (!redisClient) {
    if (process.env.NODE_ENV === 'test') {
      redisClient = {
        get: async () => null,
        setex: async () => 'OK',
        ping: async () => 'PONG',
      } as unknown as Redis;
    } else {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!url || !token) {
        throw new Error(
          'Redis configuration missing: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required',
        );
      }
      redisClient = new Redis({ url, token });
    }
  }
  return redisClient;
};

const MAX_REQUESTS_PER_HOUR = 20;
const WINDOW_DURATION = '1 h';

export const getRatelimitClient = () => {
  if (!ratelimitClient) {
    ratelimitClient = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_HOUR, WINDOW_DURATION),
      analytics: true,
    });
  }
  return ratelimitClient;
};
