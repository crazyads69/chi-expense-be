import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { db } from './db/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

import type { Express, Request, Response } from 'express';

async function bootstrap(): Promise<Express> {
  // Auto-migrate database on cold start (Vercel serverless + local dev).
  // Migrations are idempotent — drizzle-kit tracks applied versions in the database,
  // so re-running on warm instances is a no-op.
  try {
    console.log('[migration] Checking database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[migration] Database migrations up to date.');
  } catch (error) {
    console.error('[migration] Migration failed:', error);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required by @thallesp/nestjs-better-auth to parse requests correctly
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  // Security: Add helmet for secure HTTP headers
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:8081',
    'chi-expense://',
    'exp://',
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, same-origin, curl)
      // AND allow explicitly configured origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await app.init();

  return app.getHttpAdapter().getInstance() as Express;
}

let cachedServer: Express | undefined;

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  (cachedServer as any)(req, res);
}

// Automatically start server if running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  bootstrap()
    .then((server) => {
      server.listen(process.env.PORT || 3000, () => {
        console.log(`Server running on port ${process.env.PORT || 3000}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start application:', err);
      process.exit(1);
    });
}
