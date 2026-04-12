import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { eq, and, like } from 'drizzle-orm';

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

    // Optimize performance: use index-supported LIKE query on dates instead of slow parsing in code
    // Assuming createdAt format is ISO string e.g. "2026-04-12T14:32:00.000Z"
    const monthlyTransactions = await db
      .select({
        amount: transactions.amount,
        category: transactions.category,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          like(transactions.createdAt, `${targetMonth}%`),
        ),
      );

    const total = monthlyTransactions.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0,
    );

    const categoryBreakdown = monthlyTransactions.reduce(
      (acc, tx) => {
        const cat = tx.category;
        if (!acc[cat]) {
          acc[cat] = { category: cat, total: 0, count: 0 };
        }
        acc[cat].total += Math.abs(tx.amount);
        acc[cat].count += 1;
        return acc;
      },
      {} as Record<string, CategoryBreakdown>,
    );

    const dailyExpenses = monthlyTransactions.reduce(
      (acc, tx) => {
        const date = tx.createdAt.split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, total: 0 };
        }
        acc[date].total += Math.abs(tx.amount);
        return acc;
      },
      {} as Record<string, DailyExpense>,
    );

    return {
      month: targetMonth,
      total,
      transactionCount: monthlyTransactions.length,
      categoryBreakdown: Object.values(categoryBreakdown).sort(
        (a, b) => b.total - a.total,
      ),
      dailyExpenses: Object.values(dailyExpenses).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    };
  }
}
