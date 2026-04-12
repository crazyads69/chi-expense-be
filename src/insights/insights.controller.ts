import { Controller, Get, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { InsightsService } from './insights.service';

@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  async getInsights(
    @Session() session: UserSession,
    @Query('month') month?: string,
  ) {
    return this.insightsService.getMonthlyInsights(session.user.id, month);
  }
}
