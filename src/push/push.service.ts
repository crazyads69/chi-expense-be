import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { pushTokens, notificationPreferences } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class PushService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async registerToken(userId: string, dto: RegisterTokenDto) {
    const platform = dto.platform as 'ios' | 'android';
    await this.db
      .insert(pushTokens)
      .values({
        id: nanoid(),
        userId,
        token: dto.token,
        platform,
      })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId,
          platform,
          updatedAt: new Date(),
        },
      });
    return { success: true };
  }

  async unregisterToken(userId: string, token: string) {
    await this.db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
    return { success: true };
  }

  async getPreferences(userId: string) {
    const result = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (result.length === 0) {
      // Return default preferences if no row exists
      return {
        userId,
        dailySummaryEnabled: true,
        dailySummaryTime: '21:00',
        budgetAlertsEnabled: true,
        budgetThreshold: 80,
      };
    }

    return result[0];
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.db
      .insert(notificationPreferences)
      .values({
        userId,
        ...dto,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          ...dto,
          updatedAt: new Date(),
        },
      });

    return this.getPreferences(userId);
  }
}
