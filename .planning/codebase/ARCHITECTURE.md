<!-- refreshed: 2026-04-29 -->
# Architecture

**Analysis Date:** 2026-04-29

## System Overview

Chi Expense Backend is a serverless-ready REST API built on **NestJS 11** with a **modular layered architecture**. It follows the standard NestJS pattern of Controllers → Services → Database, with cross-cutting concerns (auth, logging, rate limiting, error tracking) applied via global pipes, interceptors, guards, and filters.

```text
┌─────────────────────────────────────────────────────────────┐
│                      Client (Mobile/Web)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                       │
│              (Serverless Function / Local Express)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Application                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  CORS/Helmet │  │ URI Version  │  │ Request Context    │ │
│  │   (main.ts)  │  │  (/api/v1)   │  │ (AsyncLocalStorage)│ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
├────────────────────────┬────────────────────────────────────┤
│     Global Interceptors │  TimeoutInterceptor (10s/25s)      │
│     Global Pipes        │  ValidationPipe (whitelist+transform)│
│     Global Filters      │  SentryGlobalFilter                  │
├────────────────────────┴────────────────────────────────────┤
│                        Controllers                           │
│  Transactions  Input  Categories  Insights  Account  Health  │
│   Controller   Controller  ...                               │
├────────────────────────┬────────────────────────────────────┤
│                        Services                              │
│  TransactionsService  InputService  CategoriesService  ...   │
├────────────────────────┬────────────────────────────────────┤
│                        Guards / Middleware                   │
│  Better Auth Session  │  RateLimitGuard (Upstash Redis)      │
├────────────────────────┴────────────────────────────────────┤
│                        Data Layer                            │
│              Drizzle ORM + @libsql/client (HTTP)             │
│                     Turso (Edge SQLite)                      │
├─────────────────────────────────────────────────────────────┤
│                   External Integrations                      │
│   OpenRouter (LLM)   │   Upstash Redis   │   Sentry        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `AppModule` | Root DI container, registers all modules, global providers | `src/app.module.ts` |
| `main.ts` | Bootstraps NestJS, configures Express adapter, Swagger, CORS, helmet, global pipes/interceptors, exports Vercel handler | `src/main.ts` |
| `DatabaseModule` | Global Drizzle ORM provider over libSQL HTTP client | `src/db/database.module.ts` |
| `AuthModule` | Better Auth integration (OAuth + Bearer tokens) | `@thallesp/nestjs-better-auth` |
| `TransactionsModule` | Core expense CRUD and pagination | `src/transactions/` |
| `InputModule` | AI expense parsing via OpenRouter (text + image) | `src/input/` |
| `InsightsModule` | Monthly spending analytics and aggregations | `src/insights/` |
| `CategoriesModule` | User category management with lazy init and Redis cache | `src/categories/` |
| `AccountModule` | GDPR data export and cascade account deletion | `src/account/` |
| `HealthController` | Dependency-aware health checks (DB + Redis) | `src/health.controller.ts` |
| `lib/` | Cross-cutting utilities: auth config, Redis, OpenRouter client, prompts, image resize, request context, timeout interceptor, shutdown service | `src/lib/` |

## Pattern Overview

**Overall:** Modular Layered Architecture (NestJS)

**Key Characteristics:**
- **Feature modules:** Each domain (transactions, input, insights, etc.) is encapsulated in its own NestJS module with controller, service, and DTOs.
- **Dependency Injection:** Services depend on abstractions (`DRIZZLE` token) rather than concrete clients.
- **Serverless-optimized:** HTTP libSQL client (not WebSocket) for Vercel cold-start compatibility; Express server cached between invocations.
- **Request-scoped context:** `AsyncLocalStorage` carries `requestId` and `startTime` through the entire request lifecycle for logging and tracing.

## Layers

**Presentation Layer (Controllers):**
- Purpose: Handle HTTP semantics, route requests, delegate to services, format responses.
- Location: `src/*/*.controller.ts`
- Contains: Route handlers, Swagger/OpenAPI decorators, DTO type annotations, `@Session()` injection.
- Depends on: Services.
- Used by: NestJS router.

**Business Logic Layer (Services):**
- Purpose: Implement domain logic, orchestrate database queries, call external APIs.
- Location: `src/*/*.service.ts`
- Contains: Business rules (e.g., negating expense amounts, budget alert checks), Drizzle queries, LLM calls, error handling.
- Depends on: Drizzle database, Redis client, external SDKs (OpenAI).
- Used by: Controllers.

**Data Access Layer (Database):**
- Purpose: Schema definition and low-level database connectivity.
- Location: `src/db/`
- Contains: Drizzle schema (`schema.ts`), database client factory (`client.ts`), `DatabaseModule`, injection token (`db-token.ts`).
- Depends on: `@libsql/client`, environment variables.
- Used by: Services, HealthController.

**Cross-Cutting Layer (lib):**
- Purpose: Shared utilities and framework configurations used by multiple modules.
- Location: `src/lib/`
- Contains: Auth configuration, Redis/rate-limit clients, OpenRouter client, image resizing, prompt templates, request context ALS, timeout interceptor, shutdown service.
- Depends on: External SDKs, environment variables.
- Used by: All layers.

## Data Flow

### Primary Request Path (CRUD)

1. **Entry** — Vercel/Express receives HTTP request (`src/main.ts:147` handler or local `bootstrap().listen()`)
2. **Bootstrap** — `main.ts` configures global prefix `api`, URI versioning, CORS, helmet, Swagger, global `ValidationPipe`, `TimeoutInterceptor`, `RequestContextInterceptor`
3. **Routing** — NestJS router matches controller based on `@Controller({ path: 'transactions', version: '1' })`
4. **Auth** — Better Auth middleware (from `@thallesp/nestjs-better-auth`) validates Bearer token and attaches `UserSession` to request
5. **Guard** — `@UseGuards(RateLimitGuard)` on LLM endpoints checks Upstash Redis sliding window (`src/input/rate-limit.guard.ts`)
6. **Validation** — `ValidationPipe` transforms and validates DTOs using `class-validator`/`class-transformer`
7. **Controller** — Extracts `@Session()` and `@Body()` / `@Query()` / `@Param()`, calls service method (`src/transactions/transactions.controller.ts`)
8. **Service** — Executes business logic and Drizzle queries (`src/transactions/transactions.service.ts`)
9. **Database** — Drizzle ORM translates to SQL and executes via `@libsql/client/http` against Turso
10. **Response** — Service result returned through Controller → NestJS → Express → Client

### AI Parsing Request Path (Text / Image)

1. **Entry** — `POST /api/v1/input/text` or `POST /api/v1/input/image`
2. **Rate Limiting** — `RateLimitGuard` enforces 20 requests/hour per user (`src/input/rate-limit.guard.ts`)
3. **Service** — `InputService.parseText()` or `InputService.parseImage()` (`src/input/input.service.ts`)
4. **Pre-processing** — Text: local regex fallback + merchant lookup. Image: `resizeImageForLLM()` via Sharp (`src/lib/image-resize.ts`)
5. **LLM Call** — `getOpenAIClient()` calls OpenRouter API (`src/lib/openrouter.ts`) with model selection from `src/lib/model-config.ts`
6. **Fallback Chain** — Image parsing retries with fallback models on network/API errors (`google/gemini-2.5-flash-lite` → `qwen/qwen3.5-flash-02-23` → `openai/gpt-4o-mini`)
7. **Post-processing** — JSON extraction from LLM response, normalization, fallback values
8. **Response** — Returns `ParsedExpense` JSON to client

### Authentication Flow

1. **OAuth Initiation** — Client redirects to `/api/auth/signin/social` (Better Auth base path)
2. **Provider Callback** — GitHub or Apple redirects to `/api/auth/callback/[provider]`
3. **Session Creation** — Better Auth creates session in Turso (`user`, `session`, `account` tables)
4. **Token Exchange** — Client receives Bearer token (via `bearer` plugin)
5. **Authenticated Requests** — Client sends `Authorization: Bearer <token>` header
6. **Session Resolution** — `@thallesp/nestjs-better-auth` `@Session()` decorator resolves token to `UserSession` on every request
7. **Anonymous Endpoints** — `@AllowAnonymous()` decorator on `HealthController` skips session validation

## Key Abstractions

**DrizzleDatabase:**
- Purpose: Type-safe database interface injected via NestJS DI.
- Examples: `src/transactions/transactions.service.ts`, `src/insights/insights.service.ts`
- Pattern: Custom provider with `DRIZZLE` Symbol token exported from `src/db/db-token.ts`.

**RequestContext:**
- Purpose: Carry request-scoped metadata (requestId, startTime) across async boundaries without manual passing.
- Examples: `src/lib/request-context.ts`, `src/lib/request-context.interceptor.ts`
- Pattern: `AsyncLocalStorage` wrapper; interceptor runs every request inside `requestContext.run()`.

**ParsedExpense:**
- Purpose: Standardized output of AI parsing regardless of input modality (text or image).
- Examples: `src/input/input.service.ts`
- Pattern: Plain interface with `amount`, `merchant`, `category`, optional `note`.

## Entry Points

**Vercel Serverless Function:**
- Location: `src/main.ts` (default export `handler`)
- Triggers: Any HTTP request routed by Vercel to the function
- Responsibilities: Lazy-bootstraps NestJS app, caches Express instance across cold starts

**Local Development Server:**
- Location: `src/main.ts` (`bootstrap().listen()`)
- Triggers: `npm run start:dev`
- Responsibilities: Boots NestJS, auto-runs Drizzle migrations, listens on `PORT`

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. No worker threads used.
- **Global state:** Module-level singletons in `src/lib/redis.ts` (lazy-initialized Redis and Ratelimit clients) and `src/lib/openrouter.ts` (OpenAI client factory). These are stateless and safe for serverless re-use.
- **Circular imports:** Not detected.
- **Serverless cold starts:** Database client uses HTTP transport (`@libsql/client/http`) because WebSocket cannot survive Vercel cold starts.
- **Body parsing:** Disabled in NestJS (`bodyParser: false`) because `@thallesp/nestjs-better-auth` requires raw body access for signature verification.
- **Database migrations:** Auto-run only in local dev (`!process.env.VERCEL`). On Vercel, migrations must be run manually before deployment.
- **Budget alerts:** Fire-and-forget async side effect in `TransactionsService.create()` — failures are logged but do not block the response.

## Anti-Patterns

### Schema Timestamp Inconsistency

**What happens:** The `transactions` and `categories` tables store `createdAt`/`updatedAt` as `text` (ISO 8601 strings), while all other tables use `integer` with `timestamp_ms` mode.
**Why it's wrong:** Mixed timestamp types prevent consistent date arithmetic, indexing optimizations, and migrations. Comment in `src/db/schema.ts` explicitly defers migration to v1.1 as "high risk, low reward."
**Do this instead:** Migrate `transactions.createdAt`, `transactions.updatedAt`, `categories.createdAt` to `integer('...', { mode: 'timestamp_ms' })` with a Drizzle migration, or consistently use `text` ISO strings everywhere.

### Synchronous Health Check on Every Request (Potential)

**What happens:** `HealthController` performs live DB `SELECT 1` and Redis `ping` on every `GET /api/health` call.
**Why it's wrong:** Under high load or aggressive monitoring pings, this adds unnecessary pressure to the database and Redis.
**Do this instead:** Cache health status for a short TTL (e.g., 5 seconds) or provide shallow (`/health/live`) and deep (`/health/ready`) endpoints.

## Error Handling

**Strategy:** Layered exception propagation with global catch-all filtering.

**Patterns:**
- **Validation errors:** `ValidationPipe` (global) automatically returns `400 Bad Request` with detailed constraint violations.
- **Domain errors:** Services throw NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, `HttpException`, `ServiceUnavailableException`).
- **Unhandled errors:** `SentryGlobalFilter` (registered as `APP_FILTER` in `AppModule`) catches all unhandled exceptions, reports them to Sentry, and returns a generic 500 response.
- **LLM-specific errors:** `InputService` categorizes errors (JSON parse failure, network timeout, API error) and maps them to appropriate HTTP status codes (`502 Bad Gateway`, `503 Service Unavailable`).

## Cross-Cutting Concerns

**Logging:** Structured JSON logging via `nestjs-pino`. Request IDs from `RequestContext` are attached to every log line. Authorization and cookie headers are redacted.

**Validation:** `class-validator` + `class-transformer` at DTO level; custom env var validation class in `AppModule`.

**Authentication:** Better Auth with OAuth 2.0 (GitHub, Apple), Bearer tokens, and Expo mobile support. Session tables (`user`, `session`, `account`) stored in Turso.

**Rate Limiting:** Upstash Redis sliding window (20 req/hour) on `POST /input/text` and `POST /input/image`.

**Observability:** Sentry error tracking with 10% performance tracing sample; spans around LLM calls (`op: 'llm.parse'`).

**Security:** Helmet for secure headers; strict CORS origin whitelist; input sanitization in `InputService` strips prompt-injection characters.

---

*Architecture analysis: 2026-04-29*
