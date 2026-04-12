import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CategoriesService } from './categories.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async list(@Session() session: UserSession) {
    return await this.categoriesService.list(session.user.id);
  }
}
