# Phase 4: Automated Quality Gates - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Requirements analysis + codebase inspection

## Phase Boundary

Write comprehensive unit and E2E tests covering all business logic, and establish CI pipeline to enforce quality on every PR. No new features — only tests and quality infrastructure.

## Implementation Decisions

### Unit Tests for Services (QAL-01)
- **D-01:** Unit tests for all 6 NestJS services using `testDb` (in-memory SQLite) as `DRIZZLE` provider.
- **D-02:** Test pattern: `Test.createTestingModule({ providers: [Service, { provide: DRIZZLE, useValue: testDb as any }] })` — `as any` required because `testDb` is `BetterSQLite3Database` but `DrizzleDatabase` type is `LibSQLDatabase`.
- **D-03:** CategoriesService tests cover: list (with lazy-init defaults), list (existing categories).
- **D-04:** TransactionsService tests cover: listByMonth (filtering, ordering), create (amount negation), update (not found), delete (not found).
- **D-05:** AccountService tests cover: deleteAccount (cascade deletion in transaction), exportData.
- **D-06:** InputService tests mock `openai.chat.completions.create()` via `jest.mock('openai')` or by mocking `getOpenAIClient` module.
- **D-07:** InsightsService tests cover: getMonthlyInsights (totals, category breakdown, daily expenses), invalid month error.
- **D-08:** RateLimitGuard tests mock `getRatelimitClient()` from `src/lib/redis` to return `{ limit: () => ({ success: boolean }) }`.

### Unit Tests for Utilities (QAL-02)
- **D-09:** Test InputService private utilities via `(service as any).methodName()` access — no extraction to separate files needed for v1.0.
- **D-10:** `parseAmount` tests: Vietnamese formats (`35k` → 35000, `50 nghìn` → 50000, `100.5k` → 100500, `100,000` → 100000, no match → 0).
- **D-11:** `lookupMerchant` tests: keyword matching (`grab` → `Di chuyển`, `cà phê` → `Ăn uống`), no match → null.
- **D-12:** `extractMerchant` tests: removes amounts, currency words (`k`, `nghìn`, `vnd`), trims to 50 chars.
- **D-13:** `sanitizeUserMessage` tests: strips JSON chars `{}[]<>`, backticks, triple quotes, preserves Vietnamese diacritics.
- **D-14:** `USER_PROMPT_TEMPLATE` tests: wraps message in `<<<USER_MESSAGE>>>` / `<<<END_USER_MESSAGE>>>` delimiters.

### E2E Tests (QAL-03)
- **D-15:** E2E tests use `AppModule` with overridden `DRIZZLE` provider (`testDb`).
- **D-16:** Auth mocking strategy: Create `test/helpers/e2e-app.ts` that adds Express middleware setting `req.session = { user: { id: 'test-user-id' } }` AFTER `app.init()`. The `@Session()` decorator reads from the request object.
- **D-17:** Cover all endpoints: `GET /api/health`, `GET /api/transactions`, `POST /api/transactions`, `PATCH /api/transactions/:id`, `DELETE /api/transactions/:id`, `GET /api/categories`, `POST /api/input/text`, `POST /api/input/image`, `GET /api/insights`, `DELETE /api/account`, `GET /api/account/export`.
- **D-18:** Happy-path flow: create category → create transaction → list transactions → get insights → update transaction → delete transaction → export data → delete account.

### CI Pipeline (QAL-04)
- **D-19:** Create `.github/workflows/ci.yml` with jobs: `lint` (`npm run lint`), `test` (`npm run test`), `migration-check` (`npx drizzle-kit check`).
- **D-20:** Workflow triggers on `pull_request` to `main` and `develop`.
- **D-21:** Remove existing `.github/workflows/db-check.yml` — merge its migration-check into the new CI workflow.
- **D-22:** Use Node.js 20, `npm ci`, fail-fast behavior.

## Canonical References

### Services
- `src/categories/categories.service.ts` — Lazy-init categories, uses `DRIZZLE`
- `src/transactions/transactions.service.ts` — CRUD operations, amount negation
- `src/account/account.service.ts` — Delete with transaction cascade, export
- `src/input/input.service.ts` — LLM parsing, private utility methods
- `src/insights/insights.service.ts` — Monthly aggregation, category breakdown
- `src/input/rate-limit.guard.ts` — Redis-based rate limiting

### Utilities
- `src/lib/prompts.ts` — `SYSTEM_PROMPT`, `USER_PROMPT_TEMPLATE`
- `src/lib/merchant-table.ts` — `MERCHANT_CATEGORY_MAP`
- `src/lib/openrouter.ts` — `getOpenAIClient()`

### Test Infrastructure
- `test/helpers/setup.ts` — In-memory SQLite `testDb`
- `test/jest-e2e.json` — E2E test config
- `src/db/db-token.ts` — `DRIZZLE` token and `DrizzleDatabase` type
- `src/db/database.module.ts` — `@Global()` database module

### Existing CI
- `.github/workflows/db-check.yml` — Migration check only

## Existing Code Insights

### Reusable Assets
- `testDb` from `test/helpers/setup.ts` is ready for injection
- `DatabaseModule` is `@Global()` and exports `DRIZZLE`
- Jest is configured with `setupFilesAfterEnv` pointing to `test/helpers/setup.ts`
- `supertest` is already installed

### Established Patterns
- Services use `@Inject(DRIZZLE)` for database access
- Controllers use `@Session()` from `@thallesp/nestjs-better-auth`
- DTOs use `class-validator` decorators
- Error handling uses NestJS exceptions (`NotFoundException`, `BadRequestException`, `HttpException`)

### Integration Points
- E2E tests need auth mocking for `@Session()` decorator
- InputService tests need OpenAI client mocking
- RateLimitGuard tests need Redis client mocking

## Deferred Ideas

- Extracting private utility methods from InputService to standalone testable functions
- Database transaction rollback between individual tests (per-test isolation)
- Parallel test execution optimization
- Test coverage threshold enforcement in CI
- Property-based testing for amount parsing
