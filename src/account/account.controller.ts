import { Controller, Get, Delete } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountService } from './account.service';

@ApiTags('Account')
@ApiBearerAuth('bearer')
@Controller({ path: 'account', version: '1' })
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Delete()
  @ApiOperation({
    summary: 'Delete user account and all data (App Store compliant)',
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteAccount(@Session() session: UserSession) {
    await this.accountService.deleteAccount(session.user.id);
    return { success: true };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export user data (GDPR compliant)' })
  @ApiResponse({ status: 200, description: 'JSON export of all user data' })
  async exportData(@Session() session: UserSession) {
    return this.accountService.exportData(session.user.id);
  }
}
