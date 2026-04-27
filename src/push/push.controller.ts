import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PushService } from './push.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('Push Notifications')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller({ path: 'api/notifications', version: '1' })
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('token')
  @ApiOperation({ summary: 'Register or update a push token' })
  @ApiResponse({ status: 200, description: 'Token registered successfully' })
  async registerToken(
    @Session() session: UserSession,
    @Body() dto: RegisterTokenDto,
  ) {
    return this.pushService.registerToken(session.user.id, dto);
  }

  @Delete('token')
  @ApiOperation({ summary: 'Unregister a push token' })
  @ApiResponse({ status: 200, description: 'Token unregistered successfully' })
  @ApiQuery({ name: 'token', required: true, description: 'Push token to unregister' })
  async unregisterToken(
    @Session() session: UserSession,
    @Query('token') token: string,
  ) {
    return this.pushService.unregisterToken(session.user.id, token);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences' })
  async getPreferences(@Session() session: UserSession) {
    return this.pushService.getPreferences(session.user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updatePreferences(
    @Session() session: UserSession,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.pushService.updatePreferences(session.user.id, dto);
  }
}
