import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { transactions } from '../db/schema';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

export interface DailyExpense {
  date: string;
  total: number;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async getMonthlyInsights(userId: string, month?: string) {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Invalid month format. Expected YYYY-MM');
    }

    const now = new Date();
    const targetMonth =
      month ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    this.logger.log(
      `Fetching insights for user ${userId} for month ${targetMonth}`,
    );

    const startOfMonth = `${targetMonth}-01T00:00:00.000Z`;
    const endDate = new Date(startOfMonth);
    endDate.setMonth(endDate.getMonth() + 1);
    const endOfMonth = endDate.toISOString();

    const whereClause = and(
      eq(transactions.userId, userId),
      gte(transactions.createdAt, startOfMonth),
      lt(transactions.createdAt, endOfMonth),
    );

    const [totalsResult] = await this.db
      .select({
        total: sql<number>`sum(abs(${transactions.amount}))`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(whereClause);

    const categoryBreakdown = await this.db
      .select({
        category: transactions.category,
        total: sql<number>`sum(abs(${transactions.amount}))`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(whereClause)
      .groupBy(transactions.category)
      .orderBy(sql`sum(abs(${transactions.amount})) DESC`);

    const dailyExpenses = await this.db
      .select({
        date: sql<string>`date(${transactions.createdAt})`,
        total: sql<number>`sum(abs(${transactions.amount}))`,
      })
      .from(transactions)
      .where(whereClause)
      .groupBy(sql`date(${transactions.createdAt})`)
      .orderBy(sql`date(${transactions.createdAt}) ASC`);

    return {
      month: targetMonth,
      total: totalsResult?.total ?? 0,
      transactionCount: totalsResult?.count ?? 0,
      categoryBreakdown,
      dailyExpenses,
    };
  }
}
