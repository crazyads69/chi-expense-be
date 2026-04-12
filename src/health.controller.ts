import { Controller, Get, Logger } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('api')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @AllowAnonymous()
  @Get('health')
  health() {
    this.logger.log('Health check endpoint called');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
