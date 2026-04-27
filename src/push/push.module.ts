import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PushController],
  providers: [PushService],
})
export class PushModule {}
