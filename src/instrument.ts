import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1, // 10% of requests for performance tracing
  profilesSampleRate: 0.0, // No profiling for now
});
