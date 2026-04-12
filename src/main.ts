import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import type { Express, Request, Response } from 'express';

async function bootstrap(): Promise<Express> {
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

  app.enableCors({
    origin: true, // Allow all origins for the mobile app to connect, or strict match if required. Vercel + Expo needs permissive CORS.
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
