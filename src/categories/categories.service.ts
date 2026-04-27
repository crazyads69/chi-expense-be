import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { categories } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getRedisClient } from '../lib/redis';

const DEFAULT_CATEGORIES = [
  { name: 'Ăn uống', slug: 'an-uong' },
  { name: 'Di chuyển', slug: 'di-chuyen' },
  { name: 'Mua sắm', slug: 'mua-sam' },
  { name: 'Giải trí', slug: 'giai-tri' },
  { name: 'Hóa đơn', slug: 'hoa-don' },
  { name: 'Sức khỏe', slug: 'suc-khoe' },
  { name: 'Giáo dục', slug: 'giao-duc' },
  { name: 'Khác', slug: 'khac' },
];

const CACHE_TTL = 60; // 60 seconds
const CACHE_PREFIX = 'categories';

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  budget: number | null;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async list(userId: string): Promise<CategoryResponse[]> {
    const cacheKey = `${CACHE_PREFIX}:${userId}`;

    // Try to get from cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        this.logger.log({ cache: 'hit', userId, key: cacheKey }, 'Categories cache hit');
        return JSON.parse(cached as string);
      }
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'Redis cache read failed');
    }

    // Cache miss - fetch from DB
    this.logger.log({ cache: 'miss', userId, key: cacheKey }, 'Categories cache miss');
    const result = await this.fetchFromDb(userId);

    // Store in cache
    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      this.logger.warn({ error: (error as Error).message }, 'Redis cache write failed');
    }

    return result;
  }

  private async fetchFromDb(userId: string): Promise<CategoryResponse[]> {
    const userCategories = await this.db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    if (userCategories.length === 0) {
      this.logger.log(
        `Lazy initializing default categories for user: ${userId}`,
      );
      // Lazy initialization: create default categories for new users
      const now = new Date().toISOString();
      const newCategories = DEFAULT_CATEGORIES.map((cat) => ({
        id: nanoid(),
        userId,
        name: cat.name,
        slug: cat.slug,
        budget: null,
        createdAt: now,
      }));

      await this.db.insert(categories).values(newCategories).onConflictDoNothing();

      const initializedCategories = await this.db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId));

      return initializedCategories.map((cat) => ({
        name: cat.name,
        slug: cat.slug,
        id: cat.id,
        budget: cat.budget,
      }));
    }

    return userCategories.map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      id: cat.id,
      budget: cat.budget,
    }));
  }
}
