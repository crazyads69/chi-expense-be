import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { transactions } from '../db/schema';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { parseMonth, getMonthBoundaries } from '../lib/date-utils';

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
    let targetMonth: string;
    try {
      targetMonth = parseMonth(month);
    } catch {
      throw new BadRequestException('Invalid month format. Expected YYYY-MM');
    }

    this.logger.log(
      `Fetching insights for user ${userId} for month ${targetMonth}`,
    );

    const { start, end } = getMonthBoundaries(targetMonth);
    const startOfMonth = start.toISOString();
    const endOfMonth = end.toISOString();

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
