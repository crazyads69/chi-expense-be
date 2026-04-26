# Integrations

**Analysis Date:** 2026-04-26

## External Services

### Turso (libSQL)

**What it's used for:** Primary database — stores all user data, auth sessions, transactions, and categories.

**How it's configured:**
- Client: `@libsql/client` ^0.17.2
- Config file: `drizzle.config.ts` (migration tooling)
- Runtime client: `src/db/client.ts`

**Environment variables:**
```
TURSO_CONNECTION_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
TURSO_SYNC_URL=      # Optional — for embedded replicas
```

**Where it's used in code:**
- `src/db/client.ts:5-9` — Client creation with URL and auth token, drizzle instantiation
- `src/db/schema.ts` — All table definitions (6 tables: user, session, account, verification, transactions, categories)
- `src/transactions/transactions.service.ts:7-8` — Imported `db` and `transactions` schema for CRUD
- `src/categories/categories.service.ts:2-3` — Imported `db` and `categories` schema
- `src/insights/insights.service.ts:2-3` — Imported `db` and `transactions` for aggregations
- `src/account/account.service.ts:2-3` — Imported `db` and all schemas for transactional deletion
- `src/lib/auth.ts:5` — `db` imported for drizzleAdapter

**Connection pattern:** Single globally-initialized client (not lazy). The `db` export is used directly across all modules. Turso supports HTTP-based libSQL protocol for edge/serverless compatibility.

**Fallback:** Falls back to `file:local.db` if `TURSO_CONNECTION_URL` is not set (`src/db/client.ts:6`, `drizzle.config.ts:8`).

---

### OpenRouter

**What it's used for:** LLM-powered natural language expense parsing. Converts Vietnamese text messages and receipt images into structured expense data (amount, merchant, category, note).

**How it's configured:**
- SDK: `openai` ^6.34.0 (OpenAI-compatible client pointed at OpenRouter)
- Config file: `src/lib/openrouter.ts`
- Base URL: `https://openrouter.ai/api/v1`

**Environment variables:**
```
OPENROUTER_API_KEY=sk-or-v1-...
```

**Where it's used in code:**
- `src/lib/openrouter.ts:5-9` — Lazy client factory function `getOpenAIClient()`
- `src/input/input.service.ts:83-92` — `parseText()`: calls `openai.chat.completions.create()` with model `qwen/qwen3-8b`, temperature 0.1, max_tokens 200
- `src/input/input.service.ts:133-158` — `parseImage()`: calls `openai.chat.completions.create()` with model `openai/gpt-4o-mini`, vision (image_url content), temperature 0.1, max_tokens 300
- `src/lib/prompts.ts` — Vietnamese system prompt and user prompt template with few-shot examples

**Models used:**

| Model | Purpose | Max Tokens | Temperature |
|-------|---------|------------|-------------|
| `qwen/qwen3-8b` | Vietnamese text expense analysis | 200 | 0.1 |
| `openai/gpt-4o-mini` | Receipt image OCR & extraction | 300 | 0.1 |

**Integration architecture:** The LLM call is a fallback in a three-tier parsing pipeline:
1. **Local lookup** — `MERCHANT_CATEGORY_MAP` (75 entries in `src/lib/merchant-table.ts`) matches known merchant names to categories
2. **LLM call** — OpenRouter API for unknown messages and all images
3. **Regex fallback** — If LLM fails, `parseAmount()` and `extractMerchant()` provide basic parsing (`src/input/input.service.ts:33-70`)

**Error handling:** On LLM failure, logs the error stack and returns a best-effort parse with `category: 'Khác'` (`src/input/input.service.ts:114-125`).

---

### Upstash Redis

**What it's used for:** Rate limiting on the AI-powered input parsing endpoints to control LLM API costs.

**How it's configured:**
- Client: `@upstash/redis` ^1.37.0 (REST-based, no persistent connection needed for serverless)
- Rate limiter: `@upstash/ratelimit` ^2.0.8
- Config file: `src/lib/redis.ts`

**Environment variables:**
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

**Where it's used in code:**
- `src/lib/redis.ts:10-15` — Lazy `Redis` client factory `getRedisClient()`
- `src/lib/redis.ts:21-28` — Lazy `Ratelimit` factory `getRatelimitClient()` with sliding window algorithm
- `src/input/rate-limit.guard.ts:26-43` — Rate limit guard checks against user ID, token, or IP

**Rate limit parameters:**
- Limit: 20 requests per hour
- Algorithm: Sliding window
- Analytics: Enabled
- Guard applied to: `POST /api/input/text` and `POST /api/input/image` (`src/input/input.controller.ts:12,18`)

**Identifier resolution order** (`src/input/rate-limit.guard.ts:22-41`):
1. Authenticated user ID (`request.user?.id`)
2. Bearer token from `Authorization` header
3. Client IP (with `x-forwarded-for` proxy header support)
4. Fallback string `'anonymous'`

**Design note:** Both clients are lazy-initialized to prevent crashes during build/startup when environment variables may not be set (e.g., Vercel build phase).

---

### GitHub OAuth

**What it's used for:** Social login authentication via Better Auth. Users can sign in with their GitHub accounts.

**How it's configured:**
- Provider: Better Auth `socialProviders.github` in `src/lib/auth.ts:17-20`
- Requires GitHub OAuth App registration (client ID and secret)

**Environment variables:**
```
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**Where it's used in code:**
- `src/lib/auth.ts:17-20` — `socialProviders.github` configuration with `clientId` and `clientSecret`
- Implicitly used by Better Auth's `/api/auth` routes for OAuth redirect/callback flow

**Apple OAuth** is also configured at `src/lib/auth.ts:21-24` with `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` env vars (same pattern as GitHub).

**Auth URL paths** handled by Better Auth (mounted under `basePath: '/api/auth'`):
- `GET /api/auth/signin` — Sign-in page
- `POST /api/auth/callback/github` — GitHub OAuth callback
- `GET /api/auth/session` — Get current session
- All standard Better Auth endpoints

---

### Vercel

**What it's used for:** Production hosting platform — serverless deployment of the NestJS application.

**How it's configured:**
- Config: `vercel.json`
- Runtime: `@vercel/node` (Node.js serverless function)
- Build command: `npm run vercel-build` → `npm run build`
- Entry point: `dist/main.js`

**Where it's used in code:**
- `vercel.json:2-15` — Build config (v2 format), routes catch-all to `dist/main.js`
- `src/main.ts:45-54` — Serverless entry point: exports a `handler` function that bootstraps NestJS once and caches the Express instance (`cachedServer`)
- `src/main.ts:57-67` — Local dev fallback: if `NODE_ENV !== 'production' && !process.env.VERCEL`, starts the Express server on `PORT` (default 3000)

**Serverless considerations in code:**
- `bodyParser: false` in `NestFactory.create()` (`src/main.ts:14`) — Better Auth needs raw body
- `crossSubDomainCookies: { enabled: true }` (`src/lib/auth.ts:38-40`) — Vercel deploys to different subdomains
- `disableTrustedOriginsCors: true` in AuthModule (`src/app.module.ts:35`) — CORS handled manually in `main.ts`
- Lazy initialization of Redis/OpenRouter clients — avoids failures during Vercel cold starts when env vars may be missing

**Deployment environment variables required:**
All listed in `.env.example`: `PORT`, `NODE_ENV`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`, `OPENROUTER_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `FRONTEND_URL`

---

## Internal Module Dependencies

### Module Import Graph

```
AppModule (src/app.module.ts)
  imports:
    └── ConfigModule.forRoot({ isGlobal: true })  ← @nestjs/config
    └── LoggerModule.forRoot({...})                ← nestjs-pino
    └── AuthModule.forRoot({ auth, ... })          ← @thallesp/nestjs-better-auth
    └── TransactionsModule                         ← src/transactions/
    └── InsightsModule                             ← src/insights/
    └── CategoriesModule                           ← src/categories/
    └── InputModule                                ← src/input/
    └── AccountModule                              ← src/account/
  controllers:
    └── HealthController                           ← src/health.controller.ts

Feature Modules (all self-contained, no inter-module imports):
  InputModule         → InputController + InputService
  TransactionsModule  → TransactionsController + TransactionsService
  InsightsModule      → InsightsController + InsightsService
  CategoriesModule    → CategoriesController + CategoriesService
  AccountModule       → AccountController + AccountService
```

**Key architectural observation:** Feature modules do NOT import each other. They are completely independent, sharing only global singletons (`db`, auth module, config). Each module directly imports `db` and schema from `src/db/` rather than going through a shared module.

---

### Cross-Module Dependencies

**Shared singletons (imported directly, not via NestJS DI):**

| Shared Resource | Defined In | Used By |
|----------------|------------|---------|
| `db` (drizzle client) | `src/db/client.ts` | `TransactionsService`, `InsightsService`, `CategoriesService`, `AccountService`, `src/lib/auth.ts` |
| `transactions` schema | `src/db/schema.ts` | `TransactionsService`, `InsightsService`, `AccountService` |
| `categories` schema | `src/db/schema.ts` | `CategoriesService`, `AccountService` |
| `user` / `session` / `account` schemas | `src/db/schema.ts` | `AccountService` (for deletion) |
| `getOpenAIClient()` | `src/lib/openrouter.ts` | `InputService` |
| `getRatelimitClient()` | `src/lib/redis.ts` | `RateLimitGuard` |
| `MERCHANT_CATEGORY_MAP` | `src/lib/merchant-table.ts` | `InputService` |
| `SYSTEM_PROMPT`, `USER_PROMPT_TEMPLATE` | `src/lib/prompts.ts` | `InputService` |

**Auth integration (`@thallesp/nestjs-better-auth`):**
- `UserSession` type and `@Session()` decorator used in: `InputController`, `TransactionsController`, `InsightsController`, `CategoriesController`, `AccountController`
- `@AllowAnonymous()` decorator used in: `HealthController`
- `auth` instance imported in `src/app.module.ts:5` for AuthModule config

---

## Data Flow Diagrams

### Authentication Flow

```
Mobile App (Expo)                     Vercel/Server                     Turso DB
     │                                    │                                │
     │  POST /api/auth/signin            │                                │
     │  (GitHub OAuth redirect)  ────────►│                                │
     │                                    │  betterAuth()                  │
     │                                    │  ┌─ socialProviders.github ──┐ │
     │  ← GitHub OAuth page ←────────────│  │  redirect to GitHub        │ │
     │                                    │  └───────────────────────────┘ │
     │  GitHub callback ─────────────────►│                                │
     │                                    │  ┌─ drizzleAdapter ──────────┐ │
     │                                    │  │  INSERT/UPDATE user       │─►│
     │                                    │  │  INSERT account           │─►│
     │                                    │  │  INSERT session           │─►│
     │                                    │  └───────────────────────────┘ │
     │  ← Set-Cookie + redirect ←────────│                                │
     │                                    │                                │
     │  API requests                     │                                │
     │  Authorization: Bearer <token> ───►│  ┌─ bearer() plugin ─────────┐ │
     │                                    │  │  Validate token           │ │
     │                                    │  │  Resolve session.user     │─►│
     │                                    │  └───────────────────────────┘ │
     │  ← JSON response ←────────────────│  @Session() → session.user.id  │
```

**Key files:**
- `src/lib/auth.ts` — Better Auth configuration (providers, plugins, adapters)
- `src/main.ts:13-16` — NestJS bootstrap with `bodyParser: false`
- `src/app.module.ts:33-36` — AuthModule import
- All controllers — `@Session()` decorator injection

---

### Expense Input Parsing Flow

```
Mobile App                     RateLimitGuard          InputService              OpenRouter
     │                              │                       │                        │
     │  POST /api/input/text       │                       │                        │
     │  { message: "cà phê 35k" }  │                       │                        │
     │  ──────────────────────────►│                       │                        │
     │                              │  getRatelimitClient() │                        │
     │                              │  ratelimit.limit(id)  │                        │
     │                              │  ┌─ Upstash Redis ──┐ │                        │
     │                              │  │  sliding window  │ │                        │
     │                              │  │  20 req/hour     │ │                        │
     │                              │  └──────────────────┘ │                        │
     │                              │                       │                        │
     │                              │  (if under limit)     │                        │
     │                              │  ────────────────────►│                        │
     │                              │                       │  parseText(userId, msg)│
     │                              │                       │  ┌──────────────────┐  │
     │                              │                       │  │ 1. lookupMerchant│  │
     │                              │                       │  │    MERCHANT_MAP  │  │
     │                              │                       │  │    "cà phê" →    │  │
     │                              │                       │  │    "Ăn uống" ✓   │  │
     │                              │                       │  └──────────────────┘  │
     │                              │                       │  (if no match → LLM)   │
     │                              │                       │  ┌──────────────────┐  │
     │                              │                       │  │ 2. parseAmount() │  │
     │                              │                       │  │    "35k" → 35000 │  │
     │                              │                       │  └──────────────────┘  │
     │                              │                       │  ┌──────────────────┐  │
     │                              │                       │  │ 3. extractMerchant│ │
     │                              │                       │  │    → "Cà phê"    │  │
     │                              │                       │  └──────────────────┘  │
     │                              │                       │                        │
     │  ← { amount: 35000,         │                       │  Return ParsedExpense  │
     │       merchant: "Cà phê",   │  ←────────────────────│                        │
     │       category: "Ăn uống" } │                       │                        │
```

**LLM path (when local lookup fails):**
```
InputService.parseText()                   OpenRouter (qwen/qwen3-8b)
     │                                            │
     │  SYSTEM_PROMPT + USER_PROMPT_TEMPLATE       │
     │  temperature: 0.1, max_tokens: 200          │
     │  ──────────────────────────────────────────►│
     │                                            │  Returns JSON:
     │  ← { "amount": 35000,                      │  { "amount": 35000,
     │       "merchant": "Cà phê",                │    "merchant": "Cà phê",
     │       "category": "Ăn uống" }              │    "category": "Ăn uống" }
     │                                            │
     │  Extract JSON from response via regex       │
     │  Fallback: parseAmount() + extractMerchant()│
     │  Fallback category: "Khác"                  │
```

**Image path:**
```
InputService.parseImage()                   OpenRouter (gpt-4o-mini)
     │                                            │
     │  Vision request with base64 image          │
     │  temperature: 0.1, max_tokens: 300          │
     │  ──────────────────────────────────────────►│
     │  ← JSON with amount, merchant, category     │
     │  Fallback: { amount: 0, merchant: "Unknown",
     │              category: "Khác" }             │
```

**Key files:**
- `src/input/input.controller.ts` — Routes with `@UseGuards(RateLimitGuard)`
- `src/input/input.service.ts` — Three-tier parsing logic
- `src/input/rate-limit.guard.ts` — Rate limit enforcement
- `src/lib/merchant-table.ts` — Local lookup table (75 entries)
- `src/lib/prompts.ts` — LLM prompt templates
- `src/lib/openrouter.ts` — OpenRouter client factory

---

### CRUD Flow

```
Mobile App              Controller              Service                   Turso DB
     │                      │                       │                        │
     │  GET /api/transactions?month=2026-04         │                        │
     │  ────────────────────►│                       │                        │
     │                      │  @Session() → userId   │                        │
     │                      │  ─────────────────────►│                        │
     │                      │                       │  validateMonth(month)   │
     │                      │                       │  db.select()            │
     │                      │                       │   .from(transactions)   │
     │                      │                       │   .where(               │
     │                      │                       │     eq(userId) AND      │
     │                      │                       │     like(createdAt,     │
     │                      │                       │       "2026-04%")       │
     │                      │                       │   )                     │
     │                      │                       │  ──────────────────────►│
     │                      │                       │  ← rows                 │
     │  ← JSON array ←──────│  ←────────────────────│                        │
     │                      │                       │                        │
     │  POST /api/transactions                      │                        │
     │  { amount: 35000,    │                       │                        │
     │    merchant: "Cà phê",│                      │                        │
     │    category: "Ăn uống",│                     │                        │
     │    source: "text" }  │                       │                        │
     │  ────────────────────►│                       │                        │
     │                      │  @Session() → userId   │                        │
     │                      │  ─────────────────────►│                        │
     │                      │                       │  nanoid() → id          │
     │                      │                       │  new Date().toISOString()│
     │                      │                       │  amount = -Math.abs(    │
     │                      │                       │    dto.amount)  (negate)│
     │                      │                       │  db.insert(transactions)│
     │                      │                       │   .values({id, userId,  │
     │                      │                       │     amount, merchant,   │
     │                      │                       │     category, source,   │
     │                      │                       │     note, createdAt,    │
     │                      │                       │     updatedAt})         │
     │                      │                       │   .returning()          │
     │                      │                       │  ──────────────────────►│
     │                      │                       │  ← inserted row         │
     │  ← transaction ←─────│  ←────────────────────│                        │
     │                      │                       │                        │
     │  PATCH /api/transactions/:id                 │                        │
     │  { category: "Giải trí" }                    │                        │
     │  ────────────────────►│                       │                        │
     │                      │  @Session() → userId   │                        │
     │                      │  ─────────────────────►│                        │
     │                      │                       │  db.update(transactions)│
     │                      │                       │   .set({category,      │
     │                      │                       │     updatedAt})         │
     │                      │                       │   .where(              │
     │                      │                       │     eq(userId) AND      │
     │                      │                       │     eq(id))             │
     │                      │                       │   .returning()          │
     │                      │                       │  ──────────────────────►│
     │                      │                       │  ← updated row          │
     │                      │                       │  if !result → 404       │
     │  ← transaction ←─────│  ←────────────────────│                        │
     │                      │                       │                        │
     │  DELETE /api/transactions/:id                 │                        │
     │  ────────────────────►│                       │                        │
     │                      │  @Session() → userId   │                        │
     │                      │  ─────────────────────►│                        │
     │                      │                       │  db.delete(transactions)│
     │                      │                       │   .where(              │
     │                      │                       │     eq(userId) AND      │
     │                      │                       │     eq(id))             │
     │                      │                       │   .returning()          │
     │                      │                       │  ──────────────────────►│
     │                      │                       │  ← deleted row          │
     │                      │                       │  if !result → 404       │
     │  ← { success: true } ←│  ←───────────────────│                        │
```

**Account deletion flow** (transactional across all tables):
```
AccountService.deleteAccount()
  db.transaction(async (tx) => {
    1. tx.delete(transactions).where(eq(transactions.userId, userId))
    2. tx.delete(categories).where(eq(categories.userId, userId))
    3. tx.delete(session).where(eq(session.userId, userId))
    4. tx.delete(account).where(eq(account.userId, userId))
    5. tx.delete(user).where(eq(user.id, userId))
  })
  → All or nothing (atomic Drizzle transaction)
```

**Key observations:**
- All CRUD operations are user-scoped via `userId` from `@Session()` decorator
- Amounts are stored as **negative integers** internally (expenses are outflows); DTOs accept positive integers
- IDs are generated with `nanoid()` not auto-increment
- Timestamps use ISO 8601 strings for application tables, milliseconds since epoch for auth tables
- List queries use `LIKE` prefix matching on ISO date strings for month filtering (leveraging the compound index `idx_transactions_user_createdAt`)
- Results are ordered `desc(createdAt)` for newest-first UX

**Key files:**
- `src/transactions/transactions.controller.ts` — REST endpoints
- `src/transactions/transactions.service.ts` — CRUD logic
- `src/transactions/dto/create-transaction.dto.ts` — Input validation
- `src/transactions/dto/update-transaction.dto.ts` — Update validation
- `src/account/account.service.ts` — Transactional account deletion
- `src/db/schema.ts:96-115` — Transactions table definition with compound index

---

*Integration audit: 2026-04-26*
