import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Lazy initialize to avoid crashing if env vars are missing during build/startup
let redisClient: Redis;
let ratelimitClient: Ratelimit;

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
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
