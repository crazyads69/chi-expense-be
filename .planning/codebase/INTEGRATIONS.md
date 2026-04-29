# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

### AI / LLM Parsing
- **OpenRouter** (`https://openrouter.ai/api/v1`)
  - Purpose: Parses raw Vietnamese text and receipt images into structured expense data
  - SDK: `openai` 6.34.0 (configured with OpenRouter base URL)
  - Auth: `OPENROUTER_API_KEY`
  - Timeout: 8000ms, max retries: 1
  - Text model default: `qwen/qwen3-8b`
  - Image model default: `google/gemini-2.5-flash-lite`
  - Fallback chain for image parsing: `google/gemini-2.5-flash-lite` → `qwen/qwen3.5-flash-02-23` → `openai/gpt-4o-mini`
  - Config: `src/lib/openrouter.ts`, `src/lib/model-config.ts`
  - Prompts: `src/lib/prompts.ts`

### Push Notifications
- **Expo Push Notification Service**
  - Purpose: Sending push notifications to mobile clients
  - SDK: `expo-server-sdk` 6.1.0
  - Push tokens stored in `push_tokens` table (`src/db/schema.ts`)
  - Platform support: iOS and Android

## Data Storage

### Primary Database
- **Turso** (libSQL / SQLite-compatible edge database)
  - Connection: `TURSO_CONNECTION_URL` (e.g., `libsql://your-db.turso.io`)
  - Auth token: `TURSO_AUTH_TOKEN`
  - Client: `@libsql/client` 0.17.2 (HTTP transport for serverless)
  - ORM: Drizzle ORM 0.45.2 with SQLite dialect
  - Schema: `src/db/schema.ts`
  - Migrations: `./drizzle/` folder, managed by `drizzle-kit`
  - Local fallback: `file:local.db` when env vars are missing

### Caching
- **Upstash Redis** (Serverless Redis via REST API)
  - Connection: `UPSTASH_REDIS_REST_URL`
  - Auth token: `UPSTASH_REDIS_REST_TOKEN`
  - Client: `@upstash/redis` 1.37.0
  - Usage:
    - Category list caching (`src/categories/categories.service.ts`) - 60-second TTL
    - Rate limiting data storage
    - Health check dependency verification
  - Config: `src/lib/redis.ts`
  - Lazy initialization; falls back to no-op mock in `test` environment

### File Storage
- **Local filesystem only** - No external object storage (S3, etc.)
- Images are processed in-memory via `sharp` and sent as base64 to LLM APIs
- No persistent image storage

## Authentication & Identity

### Auth Framework
- **Better Auth** 1.6.2
  - Implementation: Self-hosted auth with Drizzle ORM adapter (`better-auth/adapters/drizzle`)
  - Session: Bearer token (`Authorization: Bearer <token>`)
  - Plugins: `expo` (mobile deep-link support), `bearer` (token-based auth)
  - Config: `src/lib/auth.ts`
  - NestJS wrapper: `@thallesp/nestjs-better-auth` 2.5.0
  - Base URL: `BETTER_AUTH_URL` (default `http://localhost:3000`)
  - Base path: `/api/auth`

### Social Login Providers
- **GitHub OAuth**
  - Client ID: `GITHUB_CLIENT_ID`
  - Client Secret: `GITHUB_CLIENT_SECRET`
  - Callback: `/api/auth/callback/github`
  - Enabled unconditionally

- **Apple Sign-In**
  - Client ID: `APPLE_CLIENT_ID` (optional)
  - Client Secret: `APPLE_CLIENT_SECRET` (optional)
  - Team ID: `APPLE_TEAM_ID` (optional)
  - Key ID: `APPLE_KEY_ID` (optional)
  - Callback: `/api/auth/callback/apple`
  - Setup guide: `docs/apple-oauth-setup.md`
  - Key rotation required every 6 months

## Monitoring & Observability

### Error Tracking
- **Sentry**
  - SDK: `@sentry/nestjs` 10.50.0
  - DSN: `SENTRY_DSN` (optional)
  - Environment: `NODE_ENV`
  - Traces sample rate: 10% (`tracesSampleRate: 0.1`)
  - Profiles sample rate: 0% (disabled)
  - Send default PII enabled
  - Instrumentation: `src/instrument.ts` (must be imported before any other modules)
  - Global filter: `SentryGlobalFilter` catches unhandled exceptions
  - Custom spans used for LLM parsing operations (`Sentry.startSpan` in `src/input/input.service.ts`)

### Logs
- Structured JSON logging via `nestjs-pino` / `pino`
- Redaction of sensitive headers (`authorization`, `cookie`, `x-better-auth-session`)
- Request correlation IDs injected via AsyncLocalStorage (`src/lib/request-context.ts`)

## Rate Limiting

- **Upstash Ratelimit** (`@upstash/ratelimit` 2.0.8)
  - Redis backend: Upstash Redis
  - Algorithm: Sliding window
  - Limit: 20 requests per hour per authenticated user
  - Applied to: `POST /api/input/text` and `POST /api/input/image` via `RateLimitGuard`
  - Analytics enabled
  - Guard: `src/input/rate-limit.guard.ts`

## Image Processing

- **sharp** 0.34.5
  - Purpose: Resize receipt images before LLM processing
  - Max width: 800px (preserving aspect ratio)
  - Output: JPEG at 85% quality (`mozjpeg`)
  - Max output size: 1MB
  - Input: base64 data URI (`data:image/jpeg;base64,...` or `data:image/png;base64,...`)
  - Output: base64 data URI
  - Config: `src/lib/image-resize.ts`

## CI/CD & Deployment

### Hosting
- **Vercel** - Serverless Functions deployment
  - Builder: `@vercel/node`
  - Entry: `src/main.ts`
  - Config: `vercel.json`
  - Environment: `NODE_OPTIONS=--experimental-require-module`
  - Cache strategy: Express server instance cached across invocations (`cachedServer` in `src/main.ts`)

### Database Migrations
- Manual migrations on Vercel (`npm run db:migrate` before deploy)
- Auto-migrations only run in local dev (check `!process.env.VERCEL` in `src/main.ts`)

## Webhooks & Callbacks

### Incoming
- OAuth callbacks:
  - `GET /api/auth/callback/github` - GitHub OAuth callback
  - `GET /api/auth/callback/apple` - Apple Sign-In callback
  - Handled by Better Auth internally

### Outgoing
- No outgoing webhooks configured
- LLM API calls to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- Push notification sends to Expo Push Service (when implemented)

## Environment Configuration

### Required Environment Variables
| Variable | Integration | Purpose |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Better Auth | Cookie/session encryption secret |
| `TURSO_CONNECTION_URL` | Turso | Database connection URL |
| `TURSO_AUTH_TOKEN` | Turso | Database authentication token |
| `GITHUB_CLIENT_ID` | GitHub OAuth | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | OAuth app client secret |
| `OPENROUTER_API_KEY` | OpenRouter | LLM API authentication |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis | Redis REST token |

### Optional Environment Variables
| Variable | Integration | Purpose |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry | Error tracking DSN |
| `APPLE_CLIENT_ID` | Apple Sign-In | Services ID identifier |
| `APPLE_CLIENT_SECRET` | Apple Sign-In | Private key contents |
| `APPLE_TEAM_ID` | Apple Sign-In | Apple Developer Team ID |
| `APPLE_KEY_ID` | Apple Sign-In | Private Key ID |
| `FRONTEND_URL` | CORS | Allowed frontend origin |
| `BETTER_AUTH_URL` | Better Auth | Public auth base URL |
| `VERCEL` | Deployment | Vercel environment flag |
| `NODE_ENV` | General | Runtime environment |
| `PORT` | Local server | HTTP server port |

### Environment Validation
- All required variables are validated at application startup using `class-validator` in `src/app.module.ts`
- Missing required variables cause the application to exit immediately with a descriptive error
- Optional variables have sensible defaults or graceful degradation

## Configuration Patterns

### Lazy Initialization
- Redis client and rate limiter are lazily initialized (`src/lib/redis.ts`)
- OpenAI client is lazily initialized (`src/lib/openrouter.ts`)
- Prevents crashes during build/startup if env vars are temporarily missing

### Test Mocks
- Redis client returns a no-op mock in `test` environment (`src/lib/redis.ts`)
- Test database uses `better-sqlite3` in-memory (`:memory:`) with Drizzle (`test/helpers/setup.ts`)

### Dual Transport Database
- HTTP client for Turso (`@libsql/client/http`) used for serverless compatibility
- Local `file:` protocol fallback for development
- WebSocket transport explicitly avoided due to cold-start issues on serverless

---

*Integration audit: 2026-04-29*
