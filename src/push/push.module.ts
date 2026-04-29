import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

export const EXPO_CLIENT = Symbol('EXPO_CLIENT');

@Module({
  imports: [DatabaseModule],
  controllers: [PushController],
  providers: [
    PushService,
    {
      provide: EXPO_CLIENT,
      useFactory: async () => {
        const { Expo } = await import('expo-server-sdk');
        return new Expo({
          accessToken: process.env.EXPO_ACCESS_TOKEN,
        });
      },
    },
  ],
  exports: [PushService],
})
export class PushModule {}
