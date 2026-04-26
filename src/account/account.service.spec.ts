import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { DRIZZLE } from '../db/db-token';
import { testDb } from '../../test/helpers/setup';
import {
  transactions,
  categories,
  user,
  session,
  account,
} from '../db/schema';
import { eq } from 'drizzle-orm';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    // Mock transaction to support async pattern used by libsql driver
    // better-sqlite3 driver uses sync transactions, but production code uses async
    jest.spyOn(testDb as any, 'transaction').mockImplementation(async (callback: any) => {
      return await callback(testDb);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: DRIZZLE, useValue: testDb as any },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  afterEach(async () => {
    await testDb
      .delete(transactions)
      .where(eq(transactions.userId, 'test-user'));
    await testDb
      .delete(categories)
      .where(eq(categories.userId, 'test-user'));
    await testDb
      .delete(session)
      .where(eq(session.userId, 'test-user'));
    await testDb
      .delete(account)
      .where(eq(account.userId, 'test-user'));
    await testDb.delete(user).where(eq(user.id, 'test-user'));
  });

  const seedUserData = async (userId: string) => {
    await testDb.insert(user).values({
      id: userId,
      name: 'Test',
      email: `test-${userId}@example.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await testDb.insert(transactions).values([
      {
        id: 'tx-1',
        userId,
        amount: -35000,
        merchant: 'Cà phê',
        category: 'Ăn uống',
        source: 'text',
        createdAt: '2026-04-15T10:00:00.000Z',
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      {
        id: 'tx-2',
        userId,
        amount: -50000,
        merchant: 'Xăng',
        category: 'Di chuyển',
        source: 'text',
        createdAt: '2026-04-16T10:00:00.000Z',
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
    ]);

    await testDb.insert(categories).values([
      {
        id: 'cat-1',
        userId,
        name: 'Ăn uống',
        slug: 'an-uong',
        budget: null,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      {
        id: 'cat-2',
        userId,
        name: 'Di chuyển',
        slug: 'di-chuyen',
        budget: null,
        createdAt: '2026-04-01T10:00:00.000Z',
      },
    ]);

    await testDb.insert(session).values({
      id: 'sess-1',
      expiresAt: new Date(Date.now() + 86400000),
      token: 'token-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
    });

    await testDb.insert(account).values({
      id: 'acc-1',
      accountId: 'github-1',
      providerId: 'github',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  describe('deleteAccount', () => {
    it('should remove all user data', async () => {
      await seedUserData('test-user');

      const result = await service.deleteAccount('test-user');

      expect(result).toEqual({ success: true });

      const remainingTx = await testDb
        .select()
        .from(transactions)
        .where(eq(transactions.userId, 'test-user'));
      expect(remainingTx).toHaveLength(0);

      const remainingCat = await testDb
        .select()
        .from(categories)
        .where(eq(categories.userId, 'test-user'));
      expect(remainingCat).toHaveLength(0);

      const remainingSess = await testDb
        .select()
        .from(session)
        .where(eq(session.userId, 'test-user'));
      expect(remainingSess).toHaveLength(0);

      const remainingAcc = await testDb
        .select()
        .from(account)
        .where(eq(account.userId, 'test-user'));
      expect(remainingAcc).toHaveLength(0);

      const remainingUser = await testDb
        .select()
        .from(user)
        .where(eq(user.id, 'test-user'));
      expect(remainingUser).toHaveLength(0);
    });
  });

  describe('exportData', () => {
    it('should return transactions and categories', async () => {
      await seedUserData('test-user');

      const result = await service.exportData('test-user');

      expect(result.exportedAt).toBeDefined();
      expect(result.transactions).toHaveLength(2);
      expect(result.categories).toHaveLength(2);
    });

    it('should return empty arrays for new user', async () => {
      const result = await service.exportData('new-user');

      expect(result.transactions).toEqual([]);
      expect(result.categories).toEqual([]);
    });
  });
});
