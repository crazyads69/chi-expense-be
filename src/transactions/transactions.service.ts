import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { eq, and, like, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  async listByMonth(userId: string, month?: string) {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Invalid month format. Expected YYYY-MM');
    }

    const now = new Date();
    const targetMonth =
      month ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          like(transactions.createdAt, `${targetMonth}%`),
        ),
      )
      .orderBy(desc(transactions.createdAt)); // Performance & UX: Usually users want newest first
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const now = new Date().toISOString();
    const id = nanoid();

    // As per spec, expenses are stored as negative amounts internally if they are outflows
    // But the DTO only accepts positive integers (@Min(1)) to prevent UI logic errors.
    // Assuming positive = expense by default. We negate it here for the database.
    const amountToStore = -Math.abs(dto.amount);

    const [result] = await db
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

    const [result] = await db
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
    const [result] = await db
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
