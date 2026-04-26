# Phase 3: Test Infrastructure & Error Resilience - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Requirements analysis + codebase inspection

## Phase Boundary

Make the codebase testable by introducing dependency injection for the database client, establish test environment configuration with in-memory SQLite, and fix silent error swallowing in LLM calls. No new features — only infrastructure and resilience improvements.

## Implementation Decisions

### Database Dependency Injection (TST-01)
- **D-01:** Create a `@Global()` `DatabaseModule` that provides the Drizzle client via a custom provider token `DRIZZLE` (Symbol).
- **D-02:** The provider factory creates the same libsql HTTP client as today (`src/db/client.ts`), but wrapped as a NestJS provider.
- **D-03:** All 5 NestJS services that currently `import { db } from '../db/client'` must be updated to receive `db` via constructor injection using `@Inject(DRIZZLE)`.
- **D-04:** Services to migrate: `TransactionsService`, `InsightsService`, `CategoriesService`, `AccountService`. `InputService` does NOT use `db` — skip it.
- **D-05:** `src/lib/auth.ts` imports `db` for Better Auth `drizzleAdapter()` — leave as singleton import. Better Auth is not a NestJS service and cannot participate in DI.
- **D-06:** Keep `src/db/client.ts` as-is — it remains the production singleton. `DatabaseModule` can re-export it or import it internally.

### Test Environment Configuration (TST-02)
- **D-07:** Install `better-sqlite3` as a devDependency for in-memory SQLite support in tests.
- **D-08:** Create `test/helpers/setup.ts` that creates an in-memory `:memory:` SQLite database, initializes Drizzle with the schema, and exports a test `db` instance.
- **D-09:** Configure Jest to use `test/helpers/setup.ts` as a global setup or module setup so `npm run test` boots without real Turso credentials.
- **D-10:** Use `drizzle-orm/better-sqlite3` driver for the in-memory test database (not libsql).

### LLM Error Resilience (TST-03)
- **D-11:** `InputService.parseText()` must throw `HttpException` with status 502 (Bad Gateway) when LLM response parsing fails (malformed JSON, missing fields).
- **D-12:** `InputService.parseText()` must throw `HttpException` with status 503 (Service Unavailable) when the OpenRouter API call fails (network error, timeout).
- **D-13:** Same pattern for `InputService.parseImage()`: 502 for parsing failures, 503 for API failures.
- **D-14:** Do NOT return silent fallback values (`{ amount: 0, merchant: 'Unknown' }`) on any LLM failure path.
- **D-15:** The merchant table fallback (`lookupMerchant`) and local regex parsing (`parseAmount`, `extractMerchant`) can still be used as fallback BEFORE attempting LLM — these are not error paths.

### OpenRouter Client Configuration (TST-04)
- **D-16:** `getOpenAIClient()` must configure `timeout: 8000` (8 seconds) and `maxRetries: 1`.
- **D-17:** Timeout errors from OpenRouter must return a clear user-facing message: `"AI parsing is taking too long. Please try again."` (or similar).
- **D-18:** Do not change the model selection (`qwen/qwen3-8b` for text, `openai/gpt-4o-mini` for image).

### Environment Variable Validation (TST-05)
- **D-19:** `EnvironmentVariables` class in `app.module.ts` must include `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as required fields.
- **D-20:** Validation error messages must remain descriptive: `"{property} is required but not set. Check your .env file."`
- **D-21:** Keep optional env vars optional: `FRONTEND_URL`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `BETTER_AUTH_URL`.

## Canonical References

### Database & DI
- `src/db/client.ts` — Production Drizzle client singleton
- `src/db/schema.ts` — Database schema definitions
- `src/app.module.ts` — Root module (add `DatabaseModule` import)
- `src/transactions/transactions.service.ts` — Uses `db` singleton
- `src/insights/insights.service.ts` — Uses `db` singleton
- `src/categories/categories.service.ts` — Uses `db` singleton
- `src/account/account.service.ts` — Uses `db` singleton
- `src/input/input.service.ts` — Does NOT use `db`

### LLM & Input
- `src/lib/openrouter.ts` — OpenAI client factory
- `src/lib/prompts.ts` — System and user prompts
- `src/lib/merchant-table.ts` — Merchant keyword map
- `src/input/input.service.ts` — `parseText()` and `parseImage()` methods
- `src/input/input.controller.ts` — Endpoint definitions

### Config & Testing
- `src/app.module.ts` — `ConfigModule.forRoot({ validate })` and `EnvironmentVariables` class
- `package.json` — Jest configuration and dependencies
- `test/jest-e2e.json` — E2E test config
- `test/app.e2e-spec.ts` — Current E2E stub

### Project docs
- `.planning/REQUIREMENTS.md` — TST-01 through TST-05
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria

## Existing Code Insights

### Reusable Assets
- `ConfigModule.forRoot` already has a `validate` function — just extend the `EnvironmentVariables` class
- `RateLimitGuard` already differentiates authenticated vs unauthenticated — no changes needed
- `class-validator` is already installed and used

### Established Patterns
- Services use `private readonly logger = new Logger(ServiceName.name)`
- Controllers use NestJS standard decorators (`@Controller`, `@Get`, `@Post`, etc.)
- DTOs use `class-validator` decorators
- Database queries use Drizzle ORM syntax (`eq`, `and`, `like`, `desc`)

### Integration Points
- `app.module.ts` — Must import `DatabaseModule`
- All service modules — Must not need changes (services are provided at module level)
- `main.ts` — Uses `db` for migrations; no change needed (not a NestJS service)

## Deferred Ideas

- Writing actual unit tests for services — deferred to Phase 4 (Quality Gates)
- E2E test scenarios — deferred to Phase 4
- Mocking the OpenRouter client for tests — deferred to Phase 4
- Database transaction rollback in tests — not needed for v1.0 (in-memory SQLite is recreated per test run)

---

*Phase: 03-test-infrastructure-error-resilience*
*Context gathered: 2026-04-26*
