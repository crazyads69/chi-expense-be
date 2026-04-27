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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@ApiTags('Transactions')
@ApiBearerAuth('bearer')
@Controller({ path: 'api/transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List user transactions with pagination' })
  @ApiQuery({ name: 'month', required: false, example: '2026-04', description: 'Filter by month (YYYY-MM)' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Items per page (default: 50, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  async list(
    @Session() session: UserSession,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page && !isNaN(parseInt(page, 10)) ? parseInt(page, 10) : undefined;
    const limitNum = limit && !isNaN(parseInt(limit, 10)) ? parseInt(limit, 10) : undefined;
    return this.transactionsService.listByMonth(
      session.user.id,
      month,
      pageNum,
      limitNum,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(
    @Session() session: UserSession,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(session.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiParam({ name: 'id', example: 'txn_abc123', description: 'Transaction ID' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({ status: 200, description: 'Transaction updated' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(session.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({ name: 'id', example: 'txn_abc123', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction deleted' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async delete(@Session() session: UserSession, @Param('id') id: string) {
    return this.transactionsService.delete(session.user.id, id);
  }
}
