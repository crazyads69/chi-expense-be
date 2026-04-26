import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { transactions } from '../db/schema';
import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}
  async listByMonth(
    userId: string,
    month?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Invalid month format. Expected YYYY-MM');
    }

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(100, Math.max(1, limit));
    const offset = (validatedPage - 1) * validatedLimit;

    const now = new Date();
    const targetMonth =
      month ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const startOfMonth = `${targetMonth}-01T00:00:00.000Z`;
    const endDate = new Date(startOfMonth);
    endDate.setMonth(endDate.getMonth() + 1);
    const endOfMonth = endDate.toISOString();

    const whereClause = and(
      eq(transactions.userId, userId),
      gte(transactions.createdAt, startOfMonth),
      lt(transactions.createdAt, endOfMonth),
    );

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(whereClause);

    const data = await this.db
      .select()
      .from(transactions)
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(validatedLimit)
      .offset(offset);

    const total = countResult?.count ?? 0;

    return {
      data,
      total,
      hasMore: total > validatedPage * validatedLimit,
    };
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const now = new Date().toISOString();
    const id = nanoid();

    // As per spec, expenses are stored as negative amounts internally if they are outflows
    // But the DTO only accepts positive integers (@Min(1)) to prevent UI logic errors.
    // Assuming positive = expense by default. We negate it here for the database.
    const amountToStore = -Math.abs(dto.amount);

    const [result] = await this.db
      .insert(transactions)
      .values({
        id,
        userId,
        amount: amountToStore,
        merchant: dto.merchant,
        category: dto.category,
        source: dto.source,
        note: dto.note || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    this.logger.log(`Created transaction ${result.id} for user ${userId}`);
    return result;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const updateData: Record<string, any> = {
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    if (dto.amount !== undefined) {
      updateData.amount = -Math.abs(dto.amount);
    }

    const [result] = await this.db
      .update(transactions)
      .set(updateData)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
      .returning();

    if (!result) {
      this.logger.warn(
        `Update failed: Transaction ${id} not found for user ${userId}`,
      );
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    this.logger.log(`Updated transaction ${id} for user ${userId}`);
    return result;
  }

  async delete(userId: string, id: string) {
    const [result] = await this.db
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
      .returning();

    if (!result) {
      this.logger.warn(
        `Delete failed: Transaction ${id} not found for user ${userId}`,
      );
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    this.logger.log(`Deleted transaction ${id} for user ${userId}`);
    return { success: true };
  }
}
