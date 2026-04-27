import { Controller, Get, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsightsService } from './insights.service';

@ApiTags('Insights')
@ApiBearerAuth('bearer')
@Controller({ path: 'api/insights', version: '1' })
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Get monthly spending insights' })
  @ApiQuery({ name: 'month', required: false, example: '2026-04', description: 'Month in YYYY-MM format' })
  @ApiResponse({ status: 200, description: 'Monthly spending breakdown' })
  async getInsights(
    @Session() session: UserSession,
    @Query('month') month?: string,
  ) {
    return this.insightsService.getMonthlyInsights(session.user.id, month);
  }
}
