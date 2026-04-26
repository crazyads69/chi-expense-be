import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { transactions, categories, user, session, account } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async deleteAccount(userId: string) {
    this.logger.log(`Starting account deletion for user: ${userId}`);
    await this.db.transaction(async (tx) => {
      // First delete related data to ensure no orphaned records (even with cascade)
      await tx.delete(transactions).where(eq(transactions.userId, userId));
      await tx.delete(categories).where(eq(categories.userId, userId));

      // Delete auth records manually to avoid issues if PRAGMA foreign_keys is OFF in edge SQLite
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));

      // Finally, delete the user from Better Auth tables
      await tx.delete(user).where(eq(user.id, userId));
    });

    this.logger.log(
      `Successfully deleted account and all associated data for user: ${userId}`,
    );
    return { success: true };
  }

  async exportData(userId: string) {
    this.logger.log(`Exporting data for user: ${userId}`);
    const userTransactions = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const userCategories = await this.db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    return {
      exportedAt: new Date().toISOString(),
      transactions: userTransactions,
      categories: userCategories,
    };
  }
}
