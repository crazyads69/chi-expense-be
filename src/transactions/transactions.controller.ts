import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Delete,
  Param,
  Patch,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Controller('api/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query('month') month?: string) {
    return this.transactionsService.listByMonth(session.user.id, month);
  }

  @Post()
  async create(
    @Session() session: UserSession,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(session.user.id, dto);
  }

  @Patch(':id')
  async update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(session.user.id, id, dto);
  }

  @Delete(':id')
  async delete(@Session() session: UserSession, @Param('id') id: string) {
    return this.transactionsService.delete(session.user.id, id);
  }
}
