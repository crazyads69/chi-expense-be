import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DRIZZLE } from '../db/db-token';
import { testDb } from '../../test/helpers/setup';
import { transactions, user } from '../db/schema';
import { eq, and } from 'drizzle-orm';

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: DRIZZLE, useValue: testDb as any },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
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

  const createTestTransaction = async (
    userId: string,
    overrides: Partial<typeof transactions.$inferInsert> = {},
  ) => {
    await ensureUser(userId);
    const defaults = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      amount: -35000,
      merchant: 'Cà phê',
      category: 'Ăn uống',
      source: 'text',
      createdAt: '2026-04-15T10:00:00.000Z',
      updatedAt: '2026-04-15T10:00:00.000Z',
    };
    const data = { ...defaults, ...overrides };
    await testDb.insert(transactions).values(data);
    return data;
  };

  describe('listByMonth', () => {
    it('should return transactions for user ordered by createdAt desc', async () => {
      await createTestTransaction('test-user', {
        id: 'tx-1',
        createdAt: '2026-04-10T10:00:00.000Z',
      });
      await createTestTransaction('test-user', {
        id: 'tx-2',
        createdAt: '2026-04-15T10:00:00.000Z',
      });

      const result = await service.listByMonth('test-user');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tx-2');
      expect(result[1].id).toBe('tx-1');
    });

    it('should filter by month parameter', async () => {
      await createTestTransaction('test-user', {
        id: 'tx-apr',
        createdAt: '2026-04-15T10:00:00.000Z',
      });
      await createTestTransaction('test-user', {
        id: 'tx-mar',
        createdAt: '2026-03-15T10:00:00.000Z',
      });

      const result = await service.listByMonth('test-user', '2026-04');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tx-apr');
    });

    it('should throw BadRequestException for invalid month format', async () => {
      await expect(
        service.listByMonth('test-user', 'bad-month'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('should store negated amount', async () => {
      await ensureUser('test-user');
      const result = await service.create('test-user', {
        amount: 35000,
        merchant: 'Cà phê',
        category: 'Ăn uống',
        source: 'text',
      });

      expect(result.amount).toBe(-35000);
      expect(result.merchant).toBe('Cà phê');
    });
  });

  describe('update', () => {
    it('should modify transaction and negate amount', async () => {
      await createTestTransaction('test-user', { id: 'tx-update' });

      const result = await service.update('test-user', 'tx-update', {
        amount: 50000,
        merchant: 'Updated',
      });

      expect(result.amount).toBe(-50000);
      expect(result.merchant).toBe('Updated');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      await expect(
        service.update('test-user', 'nonexistent-id', { amount: 10000 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should remove transaction', async () => {
      await createTestTransaction('test-user', { id: 'tx-delete' });

      const result = await service.delete('test-user', 'tx-delete');

      expect(result).toEqual({ success: true });

      const remaining = await testDb
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, 'test-user'),
            eq(transactions.id, 'tx-delete'),
          ),
        );
      expect(remaining).toHaveLength(0);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      await expect(
        service.delete('test-user', 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
