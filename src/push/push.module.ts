import { Module } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';
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
      useFactory: () => {
        return new Expo({
          accessToken: process.env.EXPO_ACCESS_TOKEN,
        });
      },
    },
  ],
  exports: [PushService],
})
export class PushModule {}
