import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { InputService } from './input.service';
import { TextInputDto } from './dto/text-input.dto';
import { ImageInputDto } from './dto/image-input.dto';
import { RateLimitGuard } from './rate-limit.guard';

@Controller('api/input')
export class InputController {
  constructor(private readonly inputService: InputService) {}

  @UseGuards(RateLimitGuard)
  @Post('text')
  async parseText(@Session() session: UserSession, @Body() dto: TextInputDto) {
    return this.inputService.parseText(session.user.id, dto.message);
  }

  @UseGuards(RateLimitGuard)
  @Post('image')
  async parseImage(
    @Session() session: UserSession,
    @Body() dto: ImageInputDto,
  ) {
    return this.inputService.parseImage(session.user.id, dto.image);
  }
}
