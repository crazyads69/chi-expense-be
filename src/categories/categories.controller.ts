import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@ApiBearerAuth('bearer')
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List user categories' })
  @ApiResponse({ status: 200, description: 'List of user categories' })
  async list(@Session() session: UserSession) {
    return await this.categoriesService.list(session.user.id);
  }
}
