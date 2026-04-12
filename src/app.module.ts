import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { TransactionsModule } from './transactions/transactions.module';
import { InsightsModule } from './insights/insights.module';
import { CategoriesModule } from './categories/categories.module';
import { InputModule } from './input/input.module';
import { AccountModule } from './account/account.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-better-auth-session"]',
          ],
          censor: '***REDACTED***',
        },
      },
    }),
    AuthModule.forRoot({
      auth,
      disableTrustedOriginsCors: true, // Prevent duplicate CORS headers since we configure it in main.ts
    }),
    TransactionsModule,
    InsightsModule,
    CategoriesModule,
    InputModule,
    AccountModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
