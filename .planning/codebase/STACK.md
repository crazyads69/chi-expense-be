# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- **TypeScript** 5.7.3 - Used throughout the entire codebase (`src/**/*.ts`, `test/**/*.ts`)
  - Target: `ES2023`
  - Module: `nodenext` with `nodenext` module resolution
  - Strict mode enabled
  - Experimental decorators and `emitDecoratorMetadata` enabled for NestJS

## Runtime

**Environment:**
- **Node.js** 22.x (specified in `engines` field of `package.json`)
- Runs as a traditional server locally and as a Vercel Serverless Function in production

**Package Manager:**
- **npm** (lockfile: `package-lock.json` present)

## Frameworks

**Core Web Framework:**
- **NestJS** 11.0.1 - Primary application framework
  - Platform: `@nestjs/platform-express` 11.0.1
  - Entry point: `src/main.ts`
  - Root module: `src/app.module.ts`
  - URI-based API versioning enabled (default version `1`, prefix `api`)
  - Global prefix: `/api`

**Testing:**
- **Jest** 30.0.0 - Test runner
  - **ts-jest** 29.2.5 - TypeScript transformation
  - **@nestjs/testing** 11.0.1 - NestJS testing utilities
  - **supertest** 7.0.0 - HTTP assertion library for E2E tests
  - Config: inline in `package.json` under `"jest"` key
  - E2E config: `test/jest-e2e.json`
  - Setup file: `test/helpers/setup.ts`

**Build & Development:**
- **Nest CLI** 11.0.0 (`@nestjs/cli`) - Build tooling and schematics
  - Config: `nest-cli.json`
  - `deleteOutDir: true` for clean builds
- **TypeScript Compiler** 5.7.3
- **ts-node** 10.9.2 - TypeScript execution for dev/debug
- **ts-loader** 9.5.2 - Webpack loader (used by Nest CLI)
- **tsconfig-paths** 4.2.0 - Path resolution for aliases

## Database & ORM

**Database:**
- **Turso** (libSQL) - Edge SQLite database
  - Client: `@libsql/client` 0.17.2 (HTTP transport for serverless compatibility)
  - Local fallback: `file:local.db`
  - Migrations stored in `./drizzle/`

**ORM:**
- **Drizzle ORM** 0.45.2
  - Schema definition: `src/db/schema.ts`
  - SQLite dialect (`drizzle-orm/sqlite-core`)
  - Provider-specific dialect: `drizzle-orm/libsql`
  - Migrations via `drizzle-kit` 0.31.10 (`db:migrate` script)
  - Config: `drizzle.config.ts`

**Test Database:**
- **better-sqlite3** 12.9.0 - In-memory SQLite for testing (`:memory:`)
  - Used in `test/helpers/setup.ts` with `drizzle-orm/better-sqlite3`

## Authentication

**Solution:** Better Auth 1.6.2
- **Wrapper:** `@thallesp/nestjs-better-auth` 2.5.0 - NestJS module integration
- **Expo Plugin:** `@better-auth/expo` 1.6.2 - Mobile app session support
- **Plugins:** `bearer` (JWT/session token), `expo` (deep link / secure store)
- **Adapter:** Drizzle adapter (`better-auth/adapters/drizzle`) with SQLite provider
- **Social Providers:** GitHub OAuth, Apple Sign-In
- **Config:** `src/lib/auth.ts`
- Session is managed via Bearer tokens (`Authorization: Bearer <token>`)

## API Documentation

- **@nestjs/swagger** 11.4.1 - OpenAPI/Swagger generation
- **swagger-ui-express** 5.0.1 - Swagger UI serving
- Interactive docs available at `/api/docs`
- Bearer auth configured in Swagger

## Validation

- **class-validator** 0.15.1 - DTO validation
- **class-transformer** 0.5.1 - Object transformation
- Global `ValidationPipe` configured in `src/main.ts` with `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`
- Environment validation via `class-validator` in `src/app.module.ts`

## Logging

- **nestjs-pino** 4.6.1 - NestJS-integrated structured logging
- **pino** 10.3.1 - Core logger
- **pino-http** 11.0.0 - HTTP request logging
- **pino-pretty** 13.1.3 (dev) - Human-readable logs in development
- Redacts `authorization`, `cookie`, and `x-better-auth-session` headers
- Request correlation IDs via custom `requestContext` (AsyncLocalStorage)

## Security

- **helmet** 8.1.0 - Secure HTTP headers
- Custom CORS configuration in `src/main.ts` allowing `chi-expense://`, `exp://`, and `FRONTEND_URL`

## Image Processing

- **sharp** 0.34.5 - Server-side image resizing
  - Resizes receipt images to max 800px width
  - Converts to JPEG at 85% quality (`mozjpeg`)
  - Enforces 1MB max output size
  - Used in: `src/lib/image-resize.ts`

## AI / LLM

- **openai** 6.34.0 - SDK used to call OpenRouter API
  - Base URL: `https://openrouter.ai/api/v1`
  - Timeout: 8000ms, max retries: 1
  - Config: `src/lib/openrouter.ts`
  - Model config: `src/lib/model-config.ts`
  - Prompts: `src/lib/prompts.ts`

## Rate Limiting & Caching

- **@upstash/redis** 1.37.0 - Serverless Redis client
- **@upstash/ratelimit** 2.0.8 - Sliding window rate limiting
  - Config: 20 requests/hour per user on LLM endpoints
  - Analytics enabled
  - Lazy initialization with test mocks
  - Config: `src/lib/redis.ts`

## Monitoring & Observability

- **@sentry/nestjs** 10.50.0 - Error tracking and performance monitoring
  - Traces sample rate: 10%
  - Profiles sample rate: 0%
  - `SentryGlobalFilter` for global error catching
  - `SentryModule.forRoot()` in `AppModule`
  - Config: `src/instrument.ts`

## Push Notifications

- **expo-server-sdk** 6.1.0 - Expo push notification service (dependency present, schema supports push tokens)
- Push token storage in `push_tokens` table (`src/db/schema.ts`)

## Utilities

- **nanoid** 5.1.7 - Unique ID generation
- **jose** 6.2.2 - JWT/JWS/JWE operations
- **rxjs** 7.8.1 - Reactive programming (NestJS dependency)
- **reflect-metadata** 0.2.2 - Metadata reflection API (required by decorators)

## Linting & Formatting

- **ESLint** 9.18.0 (flat config)
  - **typescript-eslint** 8.20.0 - TypeScript rules
  - **eslint-config-prettier** 10.0.1 - Disables conflicting rules
  - **eslint-plugin-prettier** 5.2.2 - Runs Prettier as ESLint rule
  - Config: `eslint.config.mjs`
  - Key rules: `@typescript-eslint/no-explicit-any: off`, `@typescript-eslint/no-floating-promises: warn`
- **Prettier** 3.4.2 - Code formatting
  - Configured via ESLint plugin (`endOfLine: auto`)

## Configuration

**Environment Variables:**
- Loaded via `dotenv` in `src/main.ts`
- Validated via `class-validator` in `src/app.module.ts` (strict validation at startup)
- Required vars: `BETTER_AUTH_SECRET`, `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENROUTER_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Optional vars: `SENTRY_DSN`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `FRONTEND_URL`, `VERCEL`, `NODE_ENV`, `PORT`

**Build Configuration:**
- `tsconfig.json` - Base TypeScript config
- `tsconfig.build.json` - Extends base, excludes `test` and `**/*spec.ts`
- `vercel.json` - Vercel deployment config using `@vercel/node` builder
- `drizzle.config.ts` - Drizzle Kit migration config

## Platform Requirements

**Development:**
- Node.js 22.x
- npm
- Turso CLI (optional, for local DB management)

**Production:**
- Vercel Serverless Functions (`@vercel/node` builder)
- Turso edge database
- Upstash Redis for caching and rate limiting

---

*Stack analysis: 2026-04-29*
