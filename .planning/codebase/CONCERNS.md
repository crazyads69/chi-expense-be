# Codebase Concerns

**Analysis Date:** 2026-04-29

## Tech Debt

**Schema timestamp inconsistency:**
- Issue: `transactions.createdAt`/`updatedAt` and `categories.createdAt` are stored as `TEXT` (ISO 8601 strings), while all other tables use `integer` with `timestamp_ms` mode.
- Files: `src/db/schema.ts` (lines 108, 128)
- Impact: Inconsistent date handling across the schema. SQLite text comparison for date ranges is less efficient than integer comparison. Migration deferred to v1.1 per code comments.
- Fix approach: Write a Drizzle migration to convert TEXT columns to integer timestamps, update all query code to use Date objects, and ensure frontend compatibility.

**Duplicate database client initialization:**
- Issue: The database client is instantiated in two places — `src/db/client.ts` (module-level singleton) and `src/db/database.module.ts` (NestJS provider factory). Both use identical configuration but create separate connection pools.
- Files: `src/db/client.ts`, `src/db/database.module.ts`
- Impact: Configuration drift risk. The `auth.ts` file imports from `client.ts` while services inject via `DatabaseModule`. On serverless (Vercel), this could mean multiple cold-start connection establishments.
- Fix approach: Consolidate client creation into a single factory function imported by both modules.

**Apple OAuth `as any` type bypass:**
- Issue: The Apple social provider configuration uses `as any` to silence TypeScript errors.
- Files: `src/lib/auth.ts` (line 24)
- Impact: Hides potential configuration mismatches and breaks type safety for a security-critical auth provider.
- Fix approach: Fix the actual type mismatch or update the `better-auth` types instead of casting.

**Budget alert stub implementation:**
- Issue: `TransactionsService.create()` triggers `checkBudgetAlert()` asynchronously, but `checkBudgetAlert()` calculates the spent amount and then does nothing with it (no notification sent, no push token usage, no return value).
- Files: `src/transactions/transactions.service.ts` (lines 112–156)
- Impact: Dead code that appears functional but silently does nothing. Wastes a DB query per transaction creation.
- Fix approach: Either complete the notification logic or remove the stub until notifications are implemented.

**Test driver mismatch:**
- Issue: Production uses `@libsql/client/http` (async HTTP client), but tests use `better-sqlite3` (sync local driver) via `test/helpers/setup.ts`.
- Files: `test/helpers/setup.ts`, `src/account/account.service.spec.ts` (lines 19–22)
- Impact: `account.service.spec.ts` has to mock `testDb.transaction` because the sync driver doesn't support async transactions. Behavior differences between drivers (e.g., foreign key enforcement, concurrency) may mask real bugs.
- Fix approach: Use `@libsql/client` with an in-memory `:memory:` URL for tests to match production driver semantics.

## Known Bugs

**Image format regex is overly restrictive:**
- Issue: `ImageInputDto` and `resizeImageForLLM` only accept `jpeg` or `png` in the data URI prefix. Common `jpg` and `webp` extensions are rejected.
- Files: `src/input/dto/image-input.dto.ts` (line 9), `src/lib/image-resize.ts` (line 19)
- Impact: Users uploading `data:image/jpg;base64,...` or `webp` receive validation errors despite the images being processable.
- Workaround: Rename `jpg` to `jpeg` client-side before upload.

**Race condition in category lazy initialization:**
- Issue: `CategoriesService.list()` checks if categories exist, then inserts defaults if none found. Two concurrent requests for a new user can both pass the existence check, but `onConflictDoNothing()` may cause the second read to return partial results.
- Files: `src/categories/categories.service.ts` (lines 69–103)
- Impact: A new user's first request could occasionally return fewer than 8 default categories.
- Fix approach: Use a single upsert query or wrap the check-and-insert logic in a transaction with a repeatable-read isolation level.

**Sentry initialized with empty DSN:**
- Issue: `instrument.ts` passes `process.env.SENTRY_DSN || ''` to `Sentry.init()`. An empty string may cause Sentry to attempt initialization and emit warnings.
- Files: `src/instrument.ts` (line 4)
- Impact: Noisy logs or unexpected Sentry behavior when `SENTRY_DSN` is unset.
- Fix approach: Conditionally call `Sentry.init()` only when `SENTRY_DSN` is truthy.

## Security Considerations

**Sentry PII collection enabled:**
- Risk: `sendDefaultPii: true` in Sentry config sends potentially sensitive personally identifiable information (IP addresses, user context) to a third-party service.
- Files: `src/instrument.ts` (line 8)
- Current mitigation: `pinoHttp` redacts `authorization`, `cookie`, and `x-better-auth-session` headers.
- Recommendations: Review whether IP collection is necessary for a mobile app backend. Consider disabling `sendDefaultPii` and explicitly attaching only safe context.

**Missing env var validation:**
- Risk: `BETTER_AUTH_URL`, `FRONTEND_URL`, `NODE_ENV`, and `PORT` are not validated by `EnvironmentVariables` in `AppModule` but are used for CORS and auth configuration.
- Files: `src/app.module.ts` (lines 26–78), `src/main.ts` (lines 62–84)
- Current mitigation: `FRONTEND_URL` falls back to `http://localhost:8081`.
- Recommendations: Add all referenced env vars to the `EnvironmentVariables` class and mark required ones with `@IsNotEmpty()`.

**CORS allows null origin:**
- Risk: `main.ts` CORS configuration allows requests with no origin (`!origin`). This permits certain types of cross-origin requests from curl, mobile apps, and potentially malicious browser contexts.
- Files: `src/main.ts` (lines 73–76)
- Current mitigation: Required for mobile app compatibility.
- Recommendations: Add a custom header check or API key validation for requests without an origin to distinguish legitimate mobile traffic from browser-based attacks.

## Performance Bottlenecks

**Insights service performs three separate aggregation queries:**
- Problem: `InsightsService.getMonthlyInsights()` runs three independent SELECT queries (totals, category breakdown, daily expenses) for the same month.
- Files: `src/insights/insights.service.ts` (lines 50–78)
- Cause: Each aggregation is fetched separately.
- Improvement path: Combine into a single query using CTEs or window functions, or cache insights results for the duration of a request.

**Transactions list does count + fetch:**
- Problem: `TransactionsService.listByMonth()` executes a `count(*)` query followed by a data query.
- Files: `src/transactions/transactions.service.ts` (lines 56–67)
- Cause: Two round-trips to the database for pagination metadata.
- Improvement path: Use a single query with `count(*) OVER()` window function, or implement cursor-based pagination to avoid counting entirely.

**Image resize loads entire image into memory:**
- Problem: `resizeImageForLLM` decodes the full base64 string into a Buffer and processes it entirely in memory with `sharp`.
- Files: `src/lib/image-resize.ts` (lines 27, 34–40)
- Cause: No streaming or size pre-check before Buffer allocation.
- Improvement path: Reject base64 payloads above a reasonable threshold (e.g., 5MB decoded) before creating the Buffer.

**No caching on transaction/insight endpoints:**
- Problem: Every request to `/transactions` or `/insights` hits the database directly.
- Files: `src/transactions/transactions.service.ts`, `src/insights/insights.service.ts`
- Improvement path: Add short-lived Redis caching for immutable or slowly-changing data (e.g., past months' insights).

## Fragile Areas

**LLM error classification by string matching:**
- Files: `src/input/input.service.ts` (lines 195–206, 313–321)
- Why fragile: Retry and error-handling logic depends on checking `error.message.toLowerCase().includes('timeout')` etc. A change in the OpenAI SDK's error message wording would break classification.
- Safe modification: Use `error.code` or `error.type` properties from `OpenAI.APIError` instead of message string matching.
- Test coverage: Partial — timeout/network errors are mocked but only cover the current message strings.

**Fallback model loop without rate-limit back-off:**
- Files: `src/input/input.service.ts` (lines 243–337)
- Why fragile: On API errors, the code immediately retries with the next fallback model. No delay or exponential back-off. Could trigger cascading rate limits across multiple providers.
- Safe modification: Add a small delay between retries (e.g., 500ms–1s) or use a retry library like `p-retry`.

**Hardcoded model IDs scattered across codebase:**
- Files: `src/lib/model-config.ts`, `src/input/input.service.ts`
- Why fragile: Model IDs are strings. A typo or upstream model deprecation would only be caught at runtime.
- Safe modification: Export model ID constants from `model-config.ts` and use them everywhere; add a startup validation that checks model availability via OpenRouter.

## Scaling Limits

**SQLite write concurrency:**
- Current capacity: Turso (libsql) handles moderate write throughput but is not designed for high-concurrency writes.
- Limit: Single-writer bottlenecks under heavy load.
- Scaling path: If transaction volume grows, migrate to PostgreSQL (e.g., Neon, Supabase) or shard by user.

**Per-user rate limit (20 req/hour):**
- Current capacity: `MAX_REQUESTS_PER_HOUR = 20` for LLM endpoints.
- Limit: Very restrictive for legitimate users parsing multiple receipts or messages in a short session.
- Scaling path: Increase the limit or implement tiered rate limits based on user activity/history.

**No pagination on data export:**
- Current capacity: `AccountService.exportData()` fetches all transactions and categories into memory.
- Limit: Users with thousands of transactions could cause memory pressure or timeouts.
- Scaling path: Add pagination, streaming JSON response, or background job with email delivery.

## Dependencies at Risk

**`better-auth` moderate vulnerability (via esbuild):**
- Risk: `better-auth` 1.6.2 has a transitive dependency on a vulnerable `esbuild` version (GHSA-67mh-4wv8-2f99, moderate severity, CWE-346).
- Impact: Development server could be accessed cross-origin. Affects `drizzle-kit` as well.
- Migration plan: Update `better-auth` to 1.6.9 and `drizzle-kit` to a patched version. Run `npm audit fix` after updating.

**`@thallesp/nestjs-better-auth` dependent on vulnerable `better-auth`:**
- Risk: The NestJS wrapper is flagged by npm audit because it depends on the same vulnerable `better-auth` range.
- Impact: Same as above.
- Migration plan: Update both packages together. Monitor for breaking changes in the wrapper's API.

**Jest v30 (prerelease/newer than "latest"):**
- Risk: `jest` is at `30.3.0` while npm considers `29.7.0` as "latest". This suggests a pre-release or very recent major version that may have instability.
- Impact: Unexpected test runner behavior, plugin incompatibilities.
- Migration plan: Pin to a stable Jest 29.x release unless v30 features are explicitly required.

## Missing Critical Features

**Incomplete budget alert notification system:**
- Problem: `checkBudgetAlert` calculates thresholds but never sends notifications. Push tokens table exists (`pushTokens`) but is never queried or used.
- Blocks: Users cannot receive budget alert notifications.
- Files: `src/transactions/transactions.service.ts` (lines 112–156), `src/db/schema.ts` (lines 136–156)

**No input sanitization on `source` field beyond enum:**
- Problem: `CreateTransactionDto.source` uses `@IsIn` but the enum is a string array. If the frontend sends an unexpected value, it fails validation. However, `input.service.ts` always sets the source implicitly.
- Blocks: Not a blocker, but lacks flexibility for new input channels.

## Test Coverage Gaps

**Untested areas:**
- `TimeoutInterceptor`: No spec file. Critical for LLM endpoint reliability.
- `RequestContextInterceptor`: No spec file. AsyncLocalStorage wrapper needs isolation testing.
- `ImageResizeService` / `resizeImageForLLM`: Only mocked in `input.service.spec.ts`. Actual sharp processing is untested.
- `Redis` module: No dedicated tests for `getRedisClient` or `getRatelimitClient`.
- `DatabaseModule` / `db/client.ts`: No tests verifying connection behavior or error handling.
- `HealthController` database failure path: Only tests mock DB; no integration test with a downed database.
- E2E tests: `jest-e2e.json` is configured, but no E2E test files were found in the repository.

## Architecture Smells

**Service layer doing too much (InputService):**
- What happens: `InputService` handles local regex parsing, merchant lookup, LLM API calls, image resizing coordination, JSON extraction, normalization, error classification, and fallback retry logic.
- Why it's wrong: Violates Single Responsibility. Changes to any of these concerns require modifying the same file.
- Do this instead: Split into `LocalExpenseParser`, `LLMExpenseParser`, `ImageExpenseParser`, and `ExpenseNormalizer` services.

**Module-level mutable state for serverless:**
- What happens: `cachedServer` in `main.ts` is a module-level `let` that caches the Express instance across Lambda invocations.
- Why it's wrong: Hard to test, potential for state leakage between invocations if not carefully managed.
- Do this instead: Encapsulate in a dedicated `ServerCache` class or use a NestJS custom provider with a singleton scope.

**Tight coupling to OpenRouter via OpenAI SDK:**
- What happens: `openrouter.ts` and `input.service.ts` are tightly coupled to the OpenAI SDK's error shapes and API.
- Why it's wrong: Switching LLM providers would require changes across multiple files.
- Do this instead: Define an `LLMProvider` interface and implement an `OpenRouterProvider` adapter.

## Deployment or Operational Concerns

**Manual migrations on Vercel:**
- Issue: Database migrations only run automatically in local development (`!process.env.VERCEL`). Production requires manual `npm run db:migrate` before each deploy.
- Files: `src/main.ts` (lines 21–33)
- Impact: Risk of deploying code incompatible with the current production schema if migrations are forgotten.
- Recommendations: Add a Vercel build step that runs migrations before `npm run build`, or implement a migration check that fails the deploy if pending migrations exist.

**Process exit on migration failure:**
- Issue: `main.ts` calls `process.exit(1)` if migrations fail, which is abrupt and prevents graceful shutdown hooks from running.
- Files: `src/main.ts` (line 31)
- Impact: Log buffers may not flush, Sentry events may be lost.
- Recommendations: Throw an error and let NestJS handle shutdown, or use `app.close()` before exiting.

**CI uses Node 20 but project requires Node 22:**
- Issue: `.github/workflows/ci.yml` specifies `node-version: '20'`, but `package.json` engines field requires `node: "22.x"`.
- Files: `.github/workflows/ci.yml` (lines 20, 40, 60)
- Impact: CI may pass with Node 20 features but fail in production on Node 22, or miss Node-22-specific behaviors.
- Recommendations: Align CI with `package.json` engines requirement.

## Hardcoded Values and Magic Numbers

| Value | Location | Context | Recommendation |
|-------|----------|---------|----------------|
| `500` (MAX_MESSAGE_LENGTH) | `src/input/input.service.ts` | Max text input length | Move to config/env |
| `50` (MAX_MERCHANT_LENGTH) | `src/input/input.service.ts` | Merchant name truncation | Move to config/env |
| `1000` (AMOUNT_MULTIPLIER) | `src/input/input.service.ts` | Vietnamese "k" conversion | Keep as constant, add comment |
| `0.1` (LLM_TEMPERATURE) | `src/input/input.service.ts` | LLM randomness | Move to config for A/B testing |
| `250` / `350` (max_tokens) | `src/input/input.service.ts` | Text/image token limits | Move to config/env |
| `25000` / `10000` | `src/lib/timeout.interceptor.ts` | LLM vs CRUD timeout | Move to config/env |
| `800` (MAX_WIDTH) | `src/lib/image-resize.ts` | Image resize width | Move to config/env |
| `85` (JPEG_QUALITY) | `src/lib/image-resize.ts` | Image compression quality | Move to config/env |
| `1024 * 1024` (1MB) | `src/lib/image-resize.ts` | Max image size | Move to config/env |
| `20` (MAX_REQUESTS_PER_HOUR) | `src/lib/redis.ts` | Rate limit | Move to config/env |
| `60` (CACHE_TTL) | `src/categories/categories.service.ts` | Category cache seconds | Move to config/env |
| `0.1` (tracesSampleRate) | `src/instrument.ts` | Sentry tracing sample | Move to config/env |
| `80` (budgetThreshold default) | `src/db/schema.ts` | Budget alert threshold % | Validate range 0–100 |
| `21:00` (dailySummaryTime default) | `src/db/schema.ts` | Notification time | Acceptable as default |

## Error-Prone Areas

**Manual amount negation:**
- Files: `src/transactions/transactions.service.ts` (lines 85, 165)
- Why error-prone: `amountToStore = -Math.abs(dto.amount)` is easy to forget. If a future developer removes `Math.abs` or changes the sign logic, the entire expense tracking logic inverts.
- Safety: Add a dedicated `Money` value object or utility that encapsulates the negation rule, and add a strong unit test for zero/positive/negative inputs.

**Date boundary string comparison:**
- Files: `src/transactions/transactions.service.ts` (lines 47–53), `src/insights/insights.service.ts` (lines 40–48)
- Why error-prone: `gte(transactions.createdAt, startOfMonth)` relies on SQLite lexicographic comparison of ISO 8601 strings. While this works for ISO strings, it is brittle if the format ever changes.
- Safety: Migrate to integer timestamps and use numeric comparisons.

**Regex-based JSON extraction from LLM output:**
- Files: `src/input/input.service.ts` (lines 96–111)
- Why error-prone: `extractJsonFromResponse` uses regex to find JSON blocks. Malformed responses or nested JSON could break extraction.
- Safety: Consider using a robust JSON extraction library (e.g., `extract-json`) or structured output mode if the model supports it.

---

*Concerns audit: 2026-04-29*
