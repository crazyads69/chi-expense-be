# Tech Stack

**Analysis Date:** 2026-04-26

## Languages & Runtime

**Primary Language:**
- TypeScript 5.7.3 — entire codebase (source and tests)
  - Config: `tsconfig.json` (strict mode, ES2023 target, NodeNext modules)
  - Build config: `tsconfig.build.json` (excludes tests)

**Runtime:**
- Node.js >= 20.x (required in `package.json` engines field)
- npm >= 10.x

**Entry point:**
- `src/main.ts` — NestJS bootstrap with Vercel serverless compatibility (exported `handler` function) and local dev fallback (`NODE_ENV !== 'production' && !process.env.VERCEL`)

## Core Framework

**NestJS v11.0.1** — framework used across all modules:

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | ^11.0.1 | Decorators, pipes, guards, interfaces |
| `@nestjs/core` | ^11.0.1 | NestJS runtime, dependency injection |
| `@nestjs/platform-express` | ^11.0.1 | Express HTTP adapter |
| `@nestjs/config` | ^4.0.4 | Environment variable loading (`ConfigModule.forRoot({ isGlobal: true })` in `src/app.module.ts:15`) |
| `@nestjs/cli` | ^11.0.0 | Build tooling (dev dependency) |

**Module system:** NestJS `@Module()` decorators. Feature modules are flat (no `imports` cross-references) — `InputModule`, `TransactionsModule`, `InsightsModule`, `CategoriesModule`, `AccountModule` all register only their own controllers and providers. The `AuthModule` from `@thallesp/nestjs-better-auth` is imported in `AppModule` (`src/app.module.ts:33-36`).

**CLI config:** `nest-cli.json` — source root is `src/`, compile option `deleteOutDir: true` cleans `dist/` before each build.

**Build scripts:**
```bash
npm run build        # nest build
npm run vercel-build # npm run build (Vercel deploy hook)
npm run start:dev    # nest start --watch
npm run start:prod   # node dist/main
```

## Database & ORM

**Database:** Turso (libSQL — SQLite-compatible, distributed edge database)
- Client: `@libsql/client` ^0.17.2
- Connection: configured in `src/db/client.ts:5-9`
- Sync: supports optional `TURSO_SYNC_URL` for embedded replicas

**ORM:** Drizzle ORM ^0.45.2
- Driver: `drizzle-orm/libsql` (`src/db/client.ts:1`)
- Schema: `src/db/schema.ts` — 5 tables defined with `sqliteTable`:
  - `user` — Better Auth users table
  - `session` — auth sessions with FK to user (cascade delete)
  - `account` — OAuth provider accounts with FK to user (cascade delete)
  - `verification` — email verification tokens
  - `transactions` — expense records with compound index `idx_transactions_user_createdAt(userId, createdAt)` for performance
  - `categories` — user-specific categories with unique index `idx_categories_user_slug(userId, slug)`
- Migrations: `drizzle-kit` ^0.31.10 (dev dependency)
  - Config: `drizzle.config.ts` — dialect `turso`, schema at `src/db/schema.ts`, output to `drizzle/`

**Schema types exported:** `Transaction`, `NewTransaction`, `Category`, `NewCategory` (`src/db/schema.ts:135-138`)

**Key ORM patterns:**
- `db.select().from(table).where(...)` — reads
- `db.insert(table).values({...}).returning()` — writes with return
- `db.update(table).set({...}).where(...).returning()` — updates
- `db.delete(table).where(...).returning()` — deletes with existence check
- `db.transaction(async (tx) => { ... })` — atomic multi-table operations (`src/account/account.service.ts:12`)

**Timestamps:**
- Better Auth tables (`user`, `session`, `account`, `verification`) use integer `timestamp_ms` with SQL `cast(unixepoch('subsecond') * 1000 as integer)` defaults
- Application tables (`transactions`, `categories`) use ISO 8601 text strings (e.g., `new Date().toISOString()`)

**ID generation:** `nanoid` ^5.1.7 for transaction and category IDs

## Authentication

**Better Auth ^1.6.2** — full auth framework

| Package | Version | Purpose |
|---------|---------|---------|
| `better-auth` | ^1.6.2 | Core auth library |
| `@better-auth/expo` | ^1.6.2 | Expo SDK for React Native mobile app |
| `@thallesp/nestjs-better-auth` | ^2.4.0 | NestJS integration module (`AuthModule`) and `@Session()` decorator |

**Auth config:** `src/lib/auth.ts`
- **Database adapter:** `drizzleAdapter(db, { provider: 'sqlite' })` (line 10)
- **Base URL & path:** `BETTER_AUTH_URL` env var, path `/api/auth`
- **Social providers:** GitHub OAuth and Apple OAuth configured at lines 16-25
- **Plugins:** `expo()` and `bearer()` (line 26) — Bearer token support for mobile API access
- **Account linking:** enabled (line 28)
- **User deletion:** enabled (line 31)
- **Trusted origins:** `chi-expense://`, `exp://`, `FRONTEND_URL` (for mobile deep links and CORS)
- **Cookie settings:** `crossSubDomainCookies: { enabled: true }`, `defaultSameSite: 'none'` for Expo OAuth callbacks (line 38-41)
- **Secure cookies:** enabled in production only (line 34)

**Auth in controllers:** All secured endpoints use the `@Session()` decorator from `@thallesp/nestjs-better-auth` to inject `UserSession` containing `session.user.id`. The `@AllowAnonymous()` decorator is used on the health endpoint (`src/health.controller.ts:8`).

**Serverless consideration:** `bodyParser: false` is set in `NestFactory.create()` in `src/main.ts:14` because Better Auth requires raw body access.

## AI/LLM

**OpenRouter** — LLM API gateway
- SDK: `openai` ^6.34.0 (standard OpenAI SDK pointed at OpenRouter's compatible API)
- Client: lazy-initialized in `src/lib/openrouter.ts` with `baseURL: 'https://openrouter.ai/api/v1'`
- Auth: `OPENROUTER_API_KEY` env var

**Models used:**
1. **Text parsing:** `qwen/qwen3-8b` (`src/input/input.service.ts:85`) — lightweight model for Vietnamese expense text extraction
   - Temperature: 0.1 (low, for deterministic parsing)
   - Max tokens: 200
2. **Image parsing:** `openai/gpt-4o-mini` (`src/input/input.service.ts:135`) — vision model for receipt image extraction
   - Temperature: 0.1
   - Max tokens: 300

**Prompt engineering:** Vietnamese-language system prompt and user prompt template in `src/lib/prompts.ts`
- System prompt instructs the model to extract `amount`, `merchant`, `category`, `note` as JSON
- Categories: Ăn uống, Di chuyển, Mua sắm, Giải trí, Hóa đơn, Sức khỏe, Giáo dục, Khác
- User prompt template provides few-shot examples in Vietnamese

**Fallback pipeline** (`src/input/input.service.ts`):
1. First try local merchant-to-category lookup using `MERCHANT_CATEGORY_MAP` (75-entry map in `src/lib/merchant-table.ts`)
2. If no local match, call OpenRouter LLM
3. If LLM fails or returns unparseable response, fall back to regex-based amount parsing (`parseAmount()` method, lines 33-57) and text-based merchant extraction (`extractMerchant()`, lines 59-70)
4. Amount is always made absolute (`Math.abs()`)

**Regex amount parsing patterns** (`src/input/input.service.ts:39-43`):
- `(\d{1,3}(?:,\d{3})*(?:[.,]\d+)?)\s*(?:k|nghìn|ng)` — Vietnamese money format with thousand suffix
- `(\d+(?:[.,]\d+)?)\s*(?:k|nghìn)` — simpler number+k suffix
- `(\d{1,3}(?:,\d{3})*(?:[.,]\d+)?)` — plain number format
- Thousand multipliers (e.g., "35k" → 35000) via `AMOUNT_MULTIPLIER = 1000`

## Rate Limiting & Caching

**Upstash Redis** — serverless Redis for rate limiting
- `@upstash/redis` ^1.37.0 — REST-based Redis client
- `@upstash/ratelimit` ^2.0.8 — ratelimit library with sliding window algorithm

**Config:** `src/lib/redis.ts`
- Lazy initialization of both `Redis` client and `Ratelimit` instance (lines 5-29)
- Rate limit: **20 requests per hour** using **sliding window** algorithm (line 25)
- Analytics enabled (line 26)

**Rate limit guard:** `src/input/rate-limit.guard.ts`
- Applied to `POST /api/input/text` and `POST /api/input/image` (`src/input/input.controller.ts:12,18`)
- Identifier priority: authenticated user ID → Bearer token hash → IP address (with `x-forwarded-for` header support for proxies) → `'anonymous'`
- Returns HTTP 429 on rate limit exceeded

**Environment vars:**
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` — auth token

## Validation & Transformation

**class-validator ^0.15.1 / class-transformer ^0.5.1** — DTO validation

**Global ValidationPipe** configured in `src/main.ts:23-29`:
- `whitelist: true` — strips non-decorated properties
- `transform: true` — auto-transforms types
- `forbidNonWhitelisted: true` — rejects unknown properties

**DTOs use decorators:**
- `@IsString()`, `@IsInt()`, `@IsOptional()`, `@Min()`, `@MaxLength()`, `@IsIn()`, `@IsNotEmpty()`
- `TextInputDto` (`src/input/dto/text-input.dto.ts`): message max 500 chars
- `ImageInputDto` (`src/input/dto/image-input.dto.ts`): base64 image max ~15MB (string length 15,000,000)
- `CreateTransactionDto` (`src/transactions/dto/create-transaction.dto.ts`): amount min 1, source enum check, merchant max 255, category max 100, note max 1000
- `UpdateTransactionDto` (`src/transactions/dto/update-transaction.dto.ts`): all fields optional

## Logging & Observability

**Pino** — structured JSON logging
- `nestjs-pino` ^4.6.1 — NestJS integration (LoggerModule)
- `pino` ^10.3.1 — core logger
- `pino-http` ^11.0.0 — HTTP request logging
- `pino-pretty` ^13.1.3 — dev-mode pretty printing (dev dependency)

**Config:** `src/app.module.ts:16-32`
- **Log level:** `'debug'` in development, `'info'` in production
- **Transport:** uses `pino-pretty` in non-production for human-readable output
- **Redaction:** sensitive headers redacted — `authorization`, `cookie`, `x-better-auth-session` — replaced with `'***REDACTED***'` (lines 23-29)

**Logger usage:** Each service has a NestJS `Logger` instance:
```typescript
private readonly logger = new Logger(ServiceName.name);
```
Used in: `TransactionsService`, `InputService`, `InsightsService`, `CategoriesService`, `AccountService`, `HealthController`

**Error logging pattern:** `this.logger.error('message', error instanceof Error ? error.stack : error)` (`src/input/input.service.ts:115-118`)

## Deployment & Infrastructure

**Vercel** — serverless hosting
- Config: `vercel.json`
  - Vercel v2 format
  - Runtime: `@vercel/node` serving `dist/main.js`
  - Route: catch-all `/(.*)` mapped to `dist/main.js` with all HTTP methods
- Build: `npm run vercel-build` (aliased to `npm run build`)
- **Serverless pattern:** `src/main.ts:45-54` exports a `handler` function that lazily bootstraps NestJS once (cached in `cachedServer`), then delegates requests to the Express instance

**Security middleware:**
- `helmet` ^8.1.0 — security HTTP headers (applied in `src/main.ts:21`)
- CORS: permissive (`origin: true`) for mobile app compatibility, with credentials enabled (`src/main.ts:31-36`)
- HTTPS cookies in production (`useSecureCookies: process.env.NODE_ENV === 'production'`, `src/lib/auth.ts:34`)

## Development Tools

| Tool | Version | Config | Purpose |
|------|---------|--------|---------|
| TypeScript | ^5.7.3 | `tsconfig.json` | Type checking, strict mode |
| ESLint | ^9.18.0 | `eslint.config.mjs` (flat config) | Linting |
| Prettier | ^3.4.2 | `.prettierrc` | Code formatting |
| Jest | ^30.0.0 | `package.json` jest section | Unit testing |
| ts-jest | ^29.2.5 | Jest transform config | TypeScript test compilation |
| Supertest | ^7.0.0 | devDependency | E2E HTTP testing |
| ts-node | ^10.9.2 | devDependency | TypeScript execution (debug) |
| tsconfig-paths | ^4.2.0 | devDependency | Path alias resolution |

**ESLint config** (`eslint.config.mjs`):
- Flat config format (ESLint v9+)
- Extends: `@eslint/js` recommended + `typescript-eslint` recommended type-checked + `eslint-plugin-prettier` recommended
- Key rules: `@typescript-eslint/no-explicit-any` disabled, `no-floating-promises` and `no-unsafe-argument` set to warn

**Prettier config** (`.prettierrc`):
- `singleQuote: true`
- `trailingComma: "all"`

**Jest config** (in `package.json`):
- Root dir: `src/`
- Test pattern: `*.spec.ts`
- Transform: `ts-jest`
- Coverage dir: `../coverage`
- Environment: `node`

**Format command:** `npm run format` — `prettier --write "src/**/*.ts" "test/**/*.ts"`

---

*Stack analysis: 2026-04-26*
