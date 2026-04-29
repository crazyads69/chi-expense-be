import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { RequestContextInterceptor } from './lib/request-context.interceptor';
import { requestContext } from './lib/request-context';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  validateSync,
} from 'class-validator';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { auth } from './lib/auth';
import { DatabaseModule } from './db/database.module';
import { TransactionsModule } from './transactions/transactions.module';
import { InsightsModule } from './insights/insights.module';
import { CategoriesModule } from './categories/categories.module';
import { InputModule } from './input/input.module';
import { AccountModule } from './account/account.module';
import { HealthController } from './health.controller';
import { ShutdownService } from './lib/shutdown.service';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  BETTER_AUTH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  TURSO_CONNECTION_URL!: string;

  @IsString()
  @IsNotEmpty()
  TURSO_AUTH_TOKEN!: string;

  @IsString()
  @IsNotEmpty()
  GITHUB_CLIENT_ID!: string;

  @IsString()
  @IsNotEmpty()
  GITHUB_CLIENT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  OPENROUTER_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  UPSTASH_REDIS_REST_URL!: string;

  @IsString()
  @IsNotEmpty()
  UPSTASH_REDIS_REST_TOKEN!: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  APPLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  APPLE_TEAM_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_KEY_ID?: string;
}

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.map(
      (e) => `${e.property} is required but not set. Check your .env file.`,
    );
    throw new Error(`Environment validation failed:\n${messages.join('\n')}`);
  }
  return validatedConfig;
}

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    DatabaseModule,
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
        customProps: () => {
          const ctx = requestContext.get();
          return {
            requestId: ctx?.requestId,
          };
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
  providers: [
    ShutdownService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
