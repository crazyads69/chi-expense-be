import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  tracesSampleRate: 0.1, // 10% of requests for performance tracing
  profilesSampleRate: 0.0, // No profiling for now
});
