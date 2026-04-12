import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/client';
import { categories } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  budget: number | null;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  async list(userId: string): Promise<CategoryResponse[]> {
    const userCategories = await db
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

      try {
        await db.insert(categories).values(newCategories);
      } catch (error: unknown) {
        // If a unique constraint violation occurs, another request already initialized them.
        // We can safely ignore it and fetch the newly created categories.
        const err = error as Error;
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          this.logger.warn(
            `Categories already initialized for user: ${userId} by a concurrent request.`,
          );
          return await this.list(userId); // Re-fetch the newly created categories
        }
        throw error;
      }

      return newCategories.map((cat) => ({
        name: cat.name,
        slug: cat.slug,
        id: cat.slug, // API expects id to be slug for legacy reasons
        budget: null,
      }));
    }

    return userCategories.map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      id: cat.slug,
      budget: cat.budget,
    }));
  }
}
