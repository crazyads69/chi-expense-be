import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { InputService } from './input.service';
import { TextInputDto } from './dto/text-input.dto';
import { ImageInputDto } from './dto/image-input.dto';
import { RateLimitGuard } from './rate-limit.guard';

@ApiTags('Input')
@ApiBearerAuth('bearer')
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@Controller({ path: 'api/input', version: '1' })
export class InputController {
  constructor(private readonly inputService: InputService) {}

  @UseGuards(RateLimitGuard)
  @Post('text')
  @ApiOperation({ summary: 'Parse raw text into an expense' })
  @ApiBody({ type: TextInputDto })
  @ApiResponse({ status: 201, description: 'Expense parsed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid text input' })
  async parseText(@Session() session: UserSession, @Body() dto: TextInputDto) {
    return this.inputService.parseText(session.user.id, dto.message);
  }

  @UseGuards(RateLimitGuard)
  @Post('image')
  @ApiOperation({ summary: 'Parse receipt image into an expense' })
  @ApiBody({ type: ImageInputDto })
  @ApiResponse({ status: 201, description: 'Image parsed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image format' })
  async parseImage(
    @Session() session: UserSession,
    @Body() dto: ImageInputDto,
  ) {
    return this.inputService.parseImage(session.user.id, dto.image);
  }
}
