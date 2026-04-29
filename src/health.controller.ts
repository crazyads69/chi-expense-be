import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DRIZZLE } from './db/db-token';
import { sql } from 'drizzle-orm';
import { getRedisClient } from './lib/redis';
import { ShutdownService } from './lib/shutdown.service';

@Controller()
@ApiTags('Health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly shutdownService: ShutdownService,
  ) {}

  @AllowAnonymous()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Health status with dependency checks',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        database: { type: 'string', example: 'connected' },
        redis: { type: 'string', example: 'connected' },
        timestamp: { type: 'string', example: '2026-04-27T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Service is shutting down' })
  async health() {
    if (this.shutdownService.isShuttingDown) {
      throw new ServiceUnavailableException('Service is shutting down');
    }

    this.logger.log('Health check endpoint called');

    let database: 'connected' | 'disconnected' = 'disconnected';
    let redis: 'connected' | 'disconnected' = 'disconnected';

    try {
      await this.db.get(sql`SELECT 1`);
      database = 'connected';
    } catch (error) {
      this.logger.error('Database health check failed:', error);
    }

    try {
      const redisClient = getRedisClient();
      await redisClient.ping();
      redis = 'connected';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
    }

    const allHealthy = database === 'connected' && redis === 'connected';

    const response = {
      status: allHealthy ? 'ok' : 'degraded',
      database,
      redis,
      timestamp: new Date().toISOString(),
    };

    if (!allHealthy) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
