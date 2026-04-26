# Architecture

**Analysis Date:** 2026-04-26

## High-Level Architecture

The project is a **NestJS modular monolith** deployed as a **Vercel serverless function**. It exposes a REST API for a mobile expense-tracking application. The backend uses six NestJS feature modules, a shared database layer via Drizzle ORM backed by Turso (libsql/SQLite), Better Auth for authentication, and OpenRouter for LLM-powered expense parsing.

The architecture follows the standard NestJS three-tier pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge Proxy                      │
│                  routes to dist/main.js                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              main.ts - Serverless Handler                 │
│   bootstrap() → NestJS App (Express) → cached server     │
│   handler(req, res) → (cachedServer as any)(req, res)    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  NestJS Middleware Pipeline               │
│   helmet → CORS → Better Auth → Guards → Pipes           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Feature Controllers                    │
│   @Controller('api/...') → Session extraction → DTO val  │
└────────┬──────────────┬──────────────┬──────────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│                    Feature Services                       │
│   account / categories / transactions / input / insights │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Data & External Layer                    │
│   Drizzle ORM (db/client.ts) → Turso/libsql (SQLite)     │
│   OpenRouter (OpenAI SDK) → LLM parsing                  │
│   Upstash Redis → Sliding-window rate limiting           │
│   Better Auth → Session/User/OAuth management            │
└─────────────────────────────────────────────────────────┘
```

## Request Lifecycle

A request is traced from the Vercel edge to the database:

1. **Vercel Gateway** receives HTTP request and routes it to `dist/main.js` per `vercel.json` configuration (lines 1-16 of `vercel.json`)
2. **`main.ts:45-54`** — The default export `handler(req, res)` is invoked by Vercel's Node.js runtime. On first invocation, `bootstrap()` is called to create the NestJS Express app. On subsequent "warm" invocations, the cached `Express` instance is reused.
3. **`main.ts:12-41`** — `bootstrap()` creates the NestFactory with `bodyParser: false` (required by `@thallesp/nestjs-better-auth` to parse requests correctly), attaches:
   - `helmet()` via `app.use(helmet())` at line 21 — adds secure HTTP headers
   - `ValidationPipe` as global pipe at lines 23-29 — whitelists, transforms, and rejects non-whitelisted properties
   - `CORS` at lines 31-36 — permissive origin (`true`), credentials enabled, standard methods + OPTIONS
   - `Logger` from `nestjs-pino` at line 18
4. **Better Auth Middleware** (injected by `AuthModule.forRoot({ auth, disableTrustedOriginsCors: true })` in `app.module.ts:33-36`) intercepts every request and:
   - Extracts the session from the request cookie or `Authorization: Bearer` header
   - Validates the session against the `session` table in Turso
   - Attaches the `user` object to the request context
5. **NestJS Router** matches the request path to a controller method based on the `@Controller('api/...')` prefix.
6. **`@Session()` decorator** (`src/account/account.controller.ts:13`) extracts the authenticated user session injected by Better Auth. Any route without `@AllowAnonymous()` or `auth.$On(…)` bypass is implicitly protected.
7. **`@Body()` DTO validation** — `ValidationPipe` at `main.ts:23-29` runs `class-validator` decorators (e.g., `@IsString`, `@Min(1)`, `@MaxLength`) on the request body before it reaches the controller method.
8. **Controller** delegates business logic to the injected **Service** (e.g., `TransactionsService`).
9. **Service** uses the `db` singleton (`src/db/client.ts:11`) — a Drizzle ORM instance backed by `@libsql/client` — to execute queries against Turso.
10. **Response** is serialized to JSON and returned through the NestJS/Express pipeline.

### Guards (Route-Specific Authorization)

- **`RateLimitGuard`** (`src/input/rate-limit.guard.ts:1-52`) — Applied only to `POST /api/input/text` and `POST /api/input/image` via `@UseGuards(RateLimitGuard)` at `src/input/input.controller.ts:12,18`. Implements `CanActivate` and uses **Upstash Redis + @upstash/ratelimit** sliding window (20 requests/hour per user or IP) to prevent LLM API abuse.
- **Built-in Better Auth guard** — All routes are implicitly protected by the Auth middleware injected via `AuthModule.forRoot()`. The `@AllowAnonymous()` decorator on `HealthController` (`src/health.controller.ts:8`) exempts the health endpoint.

## Module Design

### Module Responsibilities

| Module | Scope | Routes | Dependencies |
|--------|-------|--------|-------------|
| **AppModule** | Root composition | — (health controller inlined) | All feature modules, ConfigModule, LoggerModule, AuthModule |
| **AccountModule** | User account management (delete, export) | `DELETE /api/account`, `GET /api/account/export` | `db` (Drizzle), `@Session()` |
| **CategoriesModule** | Category listing with lazy initialization | `GET /api/categories` | `db` (Drizzle), `@Session()` |
| **TransactionsModule** | CRUD for expense transactions | `GET /api/transactions`, `POST /api/transactions`, `PATCH /api/transactions/:id`, `DELETE /api/transactions/:id` | `db` (Drizzle), `@Session()`, `CreateTransactionDto`, `UpdateTransactionDto` |
| **InputModule** | LLM-powered text/receipt expense parsing | `POST /api/input/text`, `POST /api/input/image` | `db` (Drizzle), `@Session()`, `RateLimitGuard`, OpenRouter (OpenAI SDK), merchant lookup table, prompt templates |
| **InsightsModule** | Monthly spending analytics | `GET /api/insights` | `db` (Drizzle), `@Session()` |

### AccountModule (`src/account/`)
- **Purpose:** Allows users to permanently delete their account and all associated data, or export all their transactions and categories as JSON.
- **Controller:** `AccountController` (`src/account/account.controller.ts`) — 2 endpoints, both inject `@Session()` for user identity.
- **Service:** `AccountService` (`src/account/account.service.ts`) — Runs a Drizzle transaction (`db.transaction()`) to cascade-delete across `transactions`, `categories`, `session`, `account`, and `user` tables (lines 12-23). Export queries both `transactions` and `categories` by `userId` (lines 33-47).

### CategoriesModule (`src/categories/`)
- **Purpose:** Returns the user's spending categories. Implements **lazy initialization**: if the user has no categories yet, 8 default Vietnamese categories (Ăn uống, Di chuyển, Mua sắm, Giải trí, Hóa đơn, Sức khỏe, Giáo dục, Khác) are inserted with `nanoid()` IDs.
- **Controller:** `CategoriesController` (`src/categories/categories.controller.ts`) — 1 endpoint (`GET /api/categories`).
- **Service:** `CategoriesService` (`src/categories/categories.service.ts`) — Lines 29-79. Handles `UNIQUE constraint failed` errors gracefully for concurrent first-time requests by re-fetching newly created categories (lines 53-61). Returns categories with `id` field aliased to `slug` for legacy API compatibility (line 68, 76).

### TransactionsModule (`src/transactions/`)
- **Purpose:** Full CRUD for expense transactions. All operations are scoped to the authenticated user. Amounts are stored as negative integers in the database (expenses are outflows), but DTOs accept positive integers only.
- **Controller:** `TransactionsController` (`src/transactions/transactions.controller.ts`) — 4 endpoints: list (GET), create (POST), update (PATCH), delete (DELETE).
- **Service:** `TransactionsService` (`src/transactions/transactions.service.ts`) — Lines 17-109.
  - `listByMonth` (line 17): Validates `YYYY-MM` format, defaults to current month if not provided. Uses `LIKE` on `createdAt` (ISO timestamp strings) with a compound index for performance.
  - `create` (line 39): Converts positive amount to `-Math.abs(dto.amount)` for storage.
  - `update` (line 67): Only updates fields present in DTO. Negates amount if provided.
  - `delete` (line 94): Returns deleted row. Throws `NotFoundException` if not found.
- **DTOs:**
  - `CreateTransactionDto` (`src/transactions/dto/create-transaction.dto.ts`): `amount` (`@IsInt`, `@Min(1)`), `merchant` (`@MaxLength(255)`), `category` (`@MaxLength(100)`), `source` (`@IsIn(['text','voice','image','sms','manual'])`), `note` (`@MaxLength(1000)`, optional).
  - `UpdateTransactionDto` (`src/transactions/dto/update-transaction.dto.ts`): All fields optional (`@IsOptional`), same constraints.

### InputModule (`src/input/`)
- **Purpose:** Accepts natural-language text or receipt images and returns a parsed `ParsedExpense` object (`amount`, `merchant`, `category`, `note?`). Uses a two-tier parsing strategy: local merchant-keyword lookup first, then falls back to OpenRouter LLM.
- **Controller:** `InputController` (`src/input/input.controller.ts`) — 2 endpoints, both protected by `RateLimitGuard`.
- **Service:** `InputService` (`src/input/input.service.ts`) — Lines 72-190.
  - `parseText` (line 72): First tries `MERCHANT_CATEGORY_MAP` lookup (line 74). On miss, calls OpenRouter with `qwen/qwen3-8b` model (line 85), Vietnamese system prompt, extracting JSON from the response.
  - `parseImage` (line 128): Sends base64 image to `openai/gpt-4o-mini` via OpenRouter (line 135). Handles both `data:` prefixed and raw base64 strings.
  - All LLM calls have `temperature: 0.1` for deterministic output.
- **Rate Limiting:** `RateLimitGuard` (`src/input/rate-limit.guard.ts`) uses Upstash Redis sliding window: 20 requests per hour per authenticated user, falling back to IP-based limiting for unauthenticated requests (lines 28-39).
- **DTOs:**
  - `TextInputDto` (`src/input/dto/text-input.dto.ts`): `message` string, max 500 chars.
  - `ImageInputDto` (`src/input/dto/image-input.dto.ts`): `image` base64 string, max ~15MB.

### InsightsModule (`src/insights/`)
- **Purpose:** Provides monthly spending analytics: total, transaction count, category breakdown (sorted by highest spend), and daily expense timeline (sorted chronologically).
- **Controller:** `InsightsController` (`src/insights/insights.controller.ts`) — 1 endpoint (`GET /api/insights?month=YYYY-MM`).
- **Service:** `InsightsService` (`src/insights/insights.service.ts`) — Lines 21-92. Queries all transactions for the given month (or current), computes aggregates in-memory via `reduce`. Uses `LIKE` on `createdAt` for month filtering (leveraging the compound index on `(user_id, created_at)`).

## Database Schema

### Overview
The database uses **Turso** (libsql/SQLite) via Drizzle ORM with 6 tables. The first 4 tables (`user`, `session`, `account`, `verification`) are Better Auth's built-in schema for authentication. The remaining 2 (`transactions`, `categories`) are application-specific.

**Connection:** `src/db/client.ts` creates a `@libsql/client` instance with credentials from environment variables (`TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`, `TURSO_SYNC_URL`) and wraps it with Drizzle.

**Migrations:** Managed via `drizzle-kit` (`drizzle.config.ts`), output to `./drizzle/` directory.

### Tables & Relationships

#### `user` (Better Auth)
*`src/db/schema.ts:10-25`*
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PRIMARY KEY |
| `name` | `text` | NOT NULL |
| `email` | `text` | NOT NULL, UNIQUE |
| `email_verified` | `integer` (boolean) | DEFAULT false, NOT NULL |
| `image` | `text` | nullable |
| `created_at` | `integer` (timestamp_ms) | DEFAULT now, NOT NULL |
| `updated_at` | `integer` (timestamp_ms) | DEFAULT now, auto-update, NOT NULL |

#### `session` (Better Auth)
*`src/db/schema.ts:27-46`*
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PRIMARY KEY |
| `expires_at` | `integer` (timestamp_ms) | NOT NULL |
| `token` | `text` | NOT NULL, UNIQUE |
| `created_at` | `integer` (timestamp_ms) | DEFAULT now, NOT NULL |
| `updated_at` | `integer` (timestamp_ms) | auto-update, NOT NULL |
| `ip_address` | `text` | nullable |
| `user_agent` | `text` | nullable |
| `user_id` | `text` | NOT NULL, FK → `user.id` ON DELETE CASCADE |

**Index:** `session_userId_idx` on `user_id`.

#### `account` (Better Auth — OAuth provider accounts)
*`src/db/schema.ts:48-76`*
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PRIMARY KEY |
| `account_id` | `text` | NOT NULL |
| `provider_id` | `text` | NOT NULL |
| `user_id` | `text` | NOT NULL, FK → `user.id` ON DELETE CASCADE |
| `access_token` | `text` | nullable |
| `refresh_token` | `text` | nullable |
| `id_token` | `text` | nullable |
| `access_token_expires_at` | `integer` (timestamp_ms) | nullable |
| `refresh_token_expires_at` | `integer` (timestamp_ms) | nullable |
| `scope` | `text` | nullable |
| `password` | `text` | nullable |
| `created_at` | `integer` (timestamp_ms) | DEFAULT now, NOT NULL |
| `updated_at` | `integer` (timestamp_ms) | auto-update, NOT NULL |

**Index:** `account_userId_idx` on `user_id`.

#### `verification` (Better Auth — email verification tokens)
*`src/db/schema.ts:78-94`*
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PRIMARY KEY |
| `identifier` | `text` | NOT NULL |
| `value` | `text` | NOT NULL |
| `expires_at` | `integer` (timestamp_ms) | NOT NULL |
| `created_at` | `integer` (timestamp_ms) | DEFAULT now, NOT NULL |
| `updated_at` | `integer` (timestamp_ms) | DEFAULT now, auto-update, NOT NULL |

**Index:** `verification_identifier_idx` on `identifier`.

#### `transactions` (Application)
*`src/db/schema.ts:96-115`*
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PRIMARY KEY |
| `user_id` | `text` | NOT NULL, FK → `user.id` ON DELETE CASCADE |
| `amount` | `integer` | NOT NULL (stored as negative for expenses) |
| `merchant` | `text` | NOT NULL |
| `category` | `text` | NOT NULL |
| `source` | `text` | NOT NULL (one of: text, voice, image, sms, manual) |
| `note` | `text` | nullable |
| `created_at` | `text` | NOT NULL (ISO 8601 string) |
| `updated_at` | `text` | NOT NULL (ISO 8601 string) |

**Index:** Compound index `idx_transactions_user_createdAt` on `(user_id, created_at)` for efficient per-user, time-range queries.

#### `categories` (Application)
*`src/db/schema.ts:117-133`*
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PRIMARY KEY |
| `user_id` | `text` | NOT NULL, FK → `user.id` ON DELETE CASCADE |
| `name` | `text` | NOT NULL |
| `slug` | `text` | NOT NULL |
| `budget` | `integer` | nullable |
| `created_at` | `text` | NOT NULL (ISO 8601 string) |

**Indices:** `idx_categories_userId` on `user_id`, **unique index** `idx_categories_user_slug` on `(user_id, slug)` — prevents duplicate category slugs per user.

### Entity Relationship Summary

```
user (1) ──────────< (many) sessions
user (1) ──────────< (many) accounts (OAuth)
user (1) ──────────< (many) transactions
user (1) ──────────< (many) categories
```

All child tables cascade-delete when the parent `user` row is removed (`ON DELETE CASCADE`).

## Authentication & Authorization

### Better Auth Configuration

**Setup:** `src/lib/auth.ts` exports a singleton `auth` instance configured with:
- **Database adapter:** `drizzleAdapter(db, { provider: 'sqlite' })` — connects Better Auth to the same Turso database (line 10)
- **Base URL:** `BETTER_AUTH_URL` env var (line 8)
- **Base path:** `/api/auth` (line 9) — all auth routes are prefixed with `/api/auth`
- **Trusted origins:** `chi-expense://` (Expo dev client), `exp://` (Expo Go), `FRONTEND_URL` (line 11-15) — used for CORS/CSRF origin checks

**Social Providers:**
- GitHub OAuth (`src/lib/auth.ts:17-19`) — `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- Apple OAuth (`src/lib/auth.ts:21-24`) — `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`

**Plugins:**
- `expo()` (`src/lib/auth.ts:26`) — Enables Expo-compatible session handling (cross-origin cookies, Bearer tokens)
- `bearer()` (`src/lib/auth.ts:26`) — Enables `Authorization: Bearer <token>` header authentication

**Advanced settings (`src/lib/auth.ts:33-42`):**
- `useSecureCookies: true` in production
- `crossSubDomainCookies: { enabled: true }` — Required for Vercel serverless environment where requests may come from different subdomains
- `defaultSameSite: 'none'` — Required for cross-origin OAuth callbacks in Expo mobile app
- `accountLinking: { enabled: true }` — Users can link multiple OAuth providers to one account
- `deleteUser: { enabled: true }` — User deletion is enabled

### NestJS Integration

`@thallesp/nestjs-better-auth` is used to bridge Better Auth into NestJS (`src/app.module.ts:33-36`):
- `AuthModule.forRoot({ auth, disableTrustedOriginsCors: true })` — Injects auth middleware
- `@Session()` decorator — Extracts the `UserSession` (containing `user.id`, `user.name`, `user.email`) in controller methods
- `@AllowAnonymous()` decorator — Opt-out of auth for specific routes (used on `HealthController`)

### Route Protection

All routes are **implicitly protected** by the Better Auth middleware. Unauthenticated requests are rejected. The only public endpoint is `GET /api/health` (annotated with `@AllowAnonymous()` at `src/health.controller.ts:8`).

## Serverless Architecture

### Vercel Deployment Pattern

The application uses the **cached server instance** pattern for Vercel serverless functions:

**`src/main.ts:43-54`** — A module-level `cachedServer` variable stores the Express app instance:
```typescript
let cachedServer: Express | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  (cachedServer as any)(req, res);
}
```

**How it works:**
1. **Cold start:** On the first request, `bootstrap()` is called, which creates the full NestJS app (module initialization, dependency injection, middleware setup). This takes longer (typically 500ms-2s for NestJS).
2. **Warm requests:** Subsequent invocations reuse the cached `Express` instance. The NestJS app is already initialized, so request handling is fast.
3. **Vercel recycles:** When the function instance is idle, Vercel may destroy it, causing a cold start on the next request.

**`vercel.json`** routes all requests (`/(.*)`) to `dist/main.js` with all HTTP methods allowed (lines 1-16).

### Local Development Fallback

**`src/main.ts:57-68`** — When `NODE_ENV !== 'production'` and `VERCEL` env var is not set, the server starts in traditional listen mode on `PORT || 3000` (lines 57-68). This avoids the serverless handler path for local development.

### Considerations

- **In-memory state is NOT shared** between function instances. This is safe since the app uses external state (Turso DB, Upstash Redis) rather than in-memory caches.
- **Body parser disabled:** `bodyParser: false` in `NestFactory.create()` (line 14) is required because Better Auth needs raw body access for request signature verification.
- **CORS is permissive** (`origin: true`) to support the Expo mobile app and multiple frontend domains.
- **No WebSocket support** (not compatible with Vercel serverless functions).

## Design Patterns Used

### 1. NestJS Module Pattern
Each feature is encapsulated in a dedicated module (`TransactionsModule`, `InsightsModule`, etc.) with its own controller and service. Modules are composed in `AppModule` via the `imports` array (`src/app.module.ts:37-41`).

### 2. Dependency Injection (DI)
All services and controllers use NestJS constructor injection (e.g., `src/transactions/transactions.controller.ts:7`:
```typescript
constructor(private readonly transactionsService: TransactionsService) {}
```
Services are marked `@Injectable()` and registered in their module's `providers` array.

### 3. DTO Validation (class-validator)
Request bodies are validated using `class-validator` decorators on DTO classes:
- `CreateTransactionDto` (`src/transactions/dto/create-transaction.dto.ts`) — `@IsInt()`, `@Min(1)`, `@IsIn([...])`, `@MaxLength()`
- `TextInputDto` (`src/input/dto/text-input.dto.ts`) — `@IsString()`, `@MaxLength(500)`
- `ImageInputDto` (`src/input/dto/image-input.dto.ts`) — `@IsString()`, `@MaxLength(15000000)`

The `ValidationPipe` (`src/main.ts:23-29`) enforces `whitelist: true` (strip unknown props), `transform: true` (auto-cast types), and `forbidNonWhitelisted: true` (reject unknown props with 400).

### 4. Guard Pattern (NestJS Guards)
- `RateLimitGuard` (`src/input/rate-limit.guard.ts`) implements `CanActivate` and is applied selectively via `@UseGuards(RateLimitGuard)` on `InputController` methods.
- Better Auth's built-in guard protects all non-`@AllowAnonymous()` routes automatically.

### 5. Lazy Initialization / Singleton Caching
- `db` client (`src/db/client.ts:11`) is a module-level singleton Drizzle instance.
- `auth` instance (`src/lib/auth.ts:7`) is a module-level singleton Better Auth instance.
- `getOpenAIClient()` (`src/lib/openrouter.ts:5-9`) is a factory function (not a singleton) — creates a fresh `OpenAI` client each call.
- `getRedisClient()` / `getRatelimitClient()` (`src/lib/redis.ts:8-30`) are lazy-initialized singletons, avoiding crashes if env vars are missing at boot.

### 6. Repository Pattern (Implicit)
Services directly use the `db` Drizzle instance exported from `src/db/client.ts` rather than a formal repository layer. Database access is centralized via the schema definition in `src/db/schema.ts`.

### 7. Decorator-Based Session Injection
The `@Session()` decorator from `@thallesp/nestjs-better-auth` extracts the authenticated user's session into a typed parameter (`UserSession`), avoiding manual auth header parsing in every controller.

### 8. Fallback / Graceful Degradation
- `CategoriesService.list()` (`src/categories/categories.service.ts:35-65`): Lazy-initializes default categories for new users, handles concurrent initialization race conditions gracefully.
- `InputService.parseText()` (`src/input/input.service.ts:72-126`): Falls back to regex-based parsing if LLM call fails or returns invalid JSON.
- `InputService.parseImage()` (`src/input/input.service.ts:128-190`): Returns default empty result on LLM failure.

## Error Handling

**Strategy:** NestJS exception classes + try/catch for external calls.

**Patterns:**
- **`NotFoundException`** — Used when a requested resource doesn't belong to the user or doesn't exist (e.g., `src/transactions/transactions.service.ts:83-87`).
- **`BadRequestException`** — Used for invalid query parameters (e.g., invalid `YYYY-MM` format at `src/transactions/transactions.service.ts:18-20` and `src/insights/insights.service.ts:22-24`).
- **`HttpException(HttpStatus.TOO_MANY_REQUESTS)`** — Rate limit guard returns 429 (`src/input/rate-limit.guard.ts:35-38`).
- **LLM errors** — Caught in try/catch, logged with `this.logger.error()`, and a fallback response is returned (lines 114-124, 178-188 of `src/input/input.service.ts`).
- **Pino logging** — All services use `nestjs-pino` Logger for structured logging (`src/app.module.ts:16-32` with sensitive header redaction).

## Cross-Cutting Concerns

| Concern | Implementation | Location |
|---------|---------------|----------|
| **Logging** | `nestjs-pino` (structured JSON logs, pretty-printed in dev) | `app.module.ts:16-32` |
| **Validation** | Global `ValidationPipe` with `class-validator` DTOs | `main.ts:23-29`, `src/**/dto/*.dto.ts` |
| **Authentication** | Better Auth with Drizzle adapter, session + Bearer token | `lib/auth.ts`, `app.module.ts:33-36` |
| **Rate Limiting** | Upstash Redis sliding window, per-user or per-IP, 20 req/hr | `input/rate-limit.guard.ts:18-30` |
| **Security Headers** | `helmet()` middleware | `main.ts:21` |
| **CORS** | Permissive (origin: true) for mobile app compatibility | `main.ts:31-36` |
| **DB Migrations** | `drizzle-kit` with Turso dialect | `drizzle.config.ts` |

---

*Architecture analysis: 2026-04-26*
