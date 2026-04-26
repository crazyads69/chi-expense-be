import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { DRIZZLE } from '../db/db-token';
import { testDb } from '../../test/helpers/setup';
import { transactions, user } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: DRIZZLE, useValue: testDb as any },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  afterEach(async () => {
    await testDb
      .delete(transactions)
      .where(eq(transactions.userId, 'test-user'));
    await testDb.delete(user).where(eq(user.id, 'test-user'));
  });

  const ensureUser = async (userId: string) => {
    const existing = await testDb
      .select()
      .from(user)
      .where(eq(user.id, userId));
    if (existing.length === 0) {
      await testDb.insert(user).values({
        id: userId,
        name: 'Test',
        email: `${userId}@example.com`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  };

  const createTransaction = async (
    userId: string,
    amount: number,
    category: string,
    createdAt: string,
  ) => {
    await ensureUser(userId);
    await testDb.insert(transactions).values({
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      amount: -Math.abs(amount),
      merchant: 'Test',
      category,
      source: 'text',
      createdAt,
      updatedAt: createdAt,
    });
  };

  describe('getMonthlyInsights', () => {
    it('should return total, category breakdown, and daily expenses', async () => {
      await createTransaction('test-user', 35000, 'Ăn uống', '2026-04-10T10:00:00.000Z');
      await createTransaction('test-user', 50000, 'Di chuyển', '2026-04-12T10:00:00.000Z');
      await createTransaction('test-user', 35000, 'Ăn uống', '2026-04-15T10:00:00.000Z');

      const result = await service.getMonthlyInsights('test-user', '2026-04');

      expect(result.total).toBe(120000);
      expect(result.transactionCount).toBe(3);
      expect(result.categoryBreakdown).toHaveLength(2);

      const anUong = result.categoryBreakdown.find(
        (c) => c.category === 'Ăn uống',
      );
      expect(anUong).toBeDefined();
      expect(anUong!.total).toBe(70000);
      expect(anUong!.count).toBe(2);

      const diChuyen = result.categoryBreakdown.find(
        (c) => c.category === 'Di chuyển',
      );
      expect(diChuyen).toBeDefined();
      expect(diChuyen!.total).toBe(50000);
      expect(diChuyen!.count).toBe(1);

      expect(result.dailyExpenses).toHaveLength(3);
      expect(result.dailyExpenses[0].date).toBe('2026-04-10');
      expect(result.dailyExpenses[1].date).toBe('2026-04-12');
      expect(result.dailyExpenses[2].date).toBe('2026-04-15');
    });

    it('should return zeros when no data', async () => {
      const result = await service.getMonthlyInsights('test-user', '2026-04');

      expect(result.total).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.categoryBreakdown).toEqual([]);
      expect(result.dailyExpenses).toEqual([]);
    });

    it('should throw BadRequestException for invalid month', async () => {
      await expect(
        service.getMonthlyInsights('test-user', 'bad-month'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
