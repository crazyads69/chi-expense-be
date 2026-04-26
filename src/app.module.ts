import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { plainToInstance } from 'class-transformer';
import { IsString, IsNotEmpty, validateSync } from 'class-validator';
import { auth } from './lib/auth';
import { DatabaseModule } from './db/database.module';
import { TransactionsModule } from './transactions/transactions.module';
import { InsightsModule } from './insights/insights.module';
import { CategoriesModule } from './categories/categories.module';
import { InputModule } from './input/input.module';
import { AccountModule } from './account/account.module';
import { HealthController } from './health.controller';

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
      (e) =>
        `${e.property} is required but not set. Check your .env file.`,
    );
    throw new Error(`Environment validation failed:\n${messages.join('\n')}`);
  }
  return validatedConfig;
}

@Module({
  imports: [
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
