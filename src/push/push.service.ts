import { Injectable, Inject, Logger } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';
import { DRIZZLE } from '../db/db-token';
import type { DrizzleDatabase } from '../db/db-token';
import { pushTokens, notificationPreferences } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { EXPO_CLIENT } from './push.module';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDatabase,
    @Inject(EXPO_CLIENT)
    private readonly expo: Expo,
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

  async sendBudgetAlert(
    userId: string,
    categoryName: string,
    spent: number,
    budget: number,
  ): Promise<void> {
    const userTokens = await this.db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));

    if (userTokens.length === 0) {
      this.logger.log(`No push tokens for user ${userId}`);
      return;
    }

    const [prefs] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (prefs && !prefs.budgetAlertsEnabled) {
      this.logger.log(`Budget alerts disabled for user ${userId}`);
      return;
    }

    const message = this.getBudgetAlertMessage(spent, budget, categoryName);
    const validTokens = userTokens
      .map((t) => t.token)
      .filter((token) => Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      this.logger.warn(`No valid Expo push tokens for user ${userId}`);
      return;
    }

    const messages = validTokens.map((token) => ({
      to: token,
      sound: 'default' as const,
      body: message,
      data: { type: 'budget_alert', category: categoryName },
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'error') {
            failureCount++;
            this.logger.error(
              `Push send failed for user ${userId}: ${ticket.message}`,
            );
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const token = chunk[i].to as string;
              await this.removeStaleToken(token);
            }
          } else {
            successCount++;
          }
        }
      } catch (error) {
        failureCount += chunk.length;
        this.logger.error(
          `Push chunk send failed for user ${userId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Budget alert sent to user ${userId}: ${successCount} success, ${failureCount} failure`,
    );
  }

  private async removeStaleToken(token: string): Promise<void> {
    await this.db
      .delete(pushTokens)
      .where(eq(pushTokens.token, token));
    this.logger.log(`Removed stale push token: ${token.slice(0, 16)}...`);
  }

  private getBudgetAlertMessage(
    spent: number,
    budget: number,
    categoryName: string,
  ): string {
    const percentage = Math.round((spent / budget) * 100);
    return `Cảnh báo: Bạn đã chi ${percentage}% ngân sách "${categoryName}" tháng này`;
  }
}
