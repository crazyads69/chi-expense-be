import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { DRIZZLE } from '../db/db-token';
import { testDb } from '../../test/helpers/setup';
import { categories, user } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: DRIZZLE, useValue: testDb as any },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(async () => {
    await testDb.delete(categories).where(eq(categories.userId, 'test-user'));
    await testDb.delete(categories).where(eq(categories.userId, 'existing-user'));
    await testDb.delete(user).where(eq(user.id, 'test-user'));
    await testDb.delete(user).where(eq(user.id, 'existing-user'));
  });

  describe('list', () => {
    it('should lazy initialize default categories for new user', async () => {
      await testDb.insert(user).values({
        id: 'test-user',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.list('test-user');

      expect(result).toHaveLength(8);
      const slugs = result.map((c) => c.slug);
      expect(slugs).toContain('an-uong');
      expect(slugs).toContain('di-chuyen');
      expect(slugs).toContain('mua-sam');
      expect(slugs).toContain('giai-tri');
      expect(slugs).toContain('hoa-don');
      expect(slugs).toContain('suc-khoe');
      expect(slugs).toContain('giao-duc');
      expect(slugs).toContain('khac');

      result.forEach((cat) => {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(cat.slug).toBeDefined();
        expect(cat.budget).toBeNull();
      });
    });

    it('should not duplicate default categories on second call', async () => {
      await testDb.insert(user).values({
        id: 'test-user',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.list('test-user');
      const result = await service.list('test-user');

      expect(result).toHaveLength(8);
    });

    it('should return existing categories without creating defaults', async () => {
      await testDb.insert(user).values({
        id: 'existing-user',
        name: 'Existing',
        email: 'existing@example.com',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert custom categories for another user
      await testDb.insert(categories).values([
        { id: 'cat-1', userId: 'existing-user', name: 'Custom', slug: 'custom', budget: null, createdAt: new Date().toISOString() },
      ]);

      const result = await service.list('existing-user');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('custom');
    });
  });
});
