import { Controller, Get, Delete } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AccountService } from './account.service';

@Controller('api/account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Delete()
  async deleteAccount(@Session() session: UserSession) {
    await this.accountService.deleteAccount(session.user.id);
    return { success: true };
  }

  @Get('export')
  async exportData(@Session() session: UserSession) {
    return this.accountService.exportData(session.user.id);
  }
}
