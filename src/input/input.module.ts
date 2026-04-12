import { Module } from '@nestjs/common';
import { InputController } from './input.controller';
import { InputService } from './input.service';

@Module({
  controllers: [InputController],
  providers: [InputService],
})
export class InputModule {}
