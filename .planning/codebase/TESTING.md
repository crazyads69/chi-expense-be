# Testing

**Analysis Date:** 2026-04-26

## Testing Framework & Configuration

### Jest Configuration

**Jest version:** `^30.0.0` (from `package.json:66`)
**TypeScript transform:** `ts-jest` `^29.2.5` (from `package.json:71`)

**Unit test config** (in `package.json:78-94`):
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

**E2E test config** (`test/jest-e2e.json`):
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

Key difference: unit tests look for `*.spec.ts` under `src/`; E2E tests look for `*.e2e-spec.ts` under `test/` (rootDir `.`).

### Test Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/testing` | `^11.0.1` | NestJS `Test.createTestingModule()` |
| `supertest` | `^7.0.0` | HTTP assertions for E2E tests |
| `@types/supertest` | `^7.0.0` | TypeScript types for supertest |
| `@types/jest` | `^30.0.0` | Jest type definitions |

---

## Test Commands

```bash
npm test                # Run unit tests (jest)
npm run test:watch      # Watch mode (jest --watch)
npm run test:cov        # Unit tests with coverage report (jest --coverage)
npm run test:debug      # Debug mode with inspector (node --inspect-brk ...)
npm run test:e2e        # Run E2E tests (jest --config ./test/jest-e2e.json)
```

---

## Test Types

### Unit Tests

**Status: NONE FOUND**

- **No `*.spec.ts` files exist anywhere in the `src/` directory.**
- The `testRegex` in `package.json:85` is configured as `.*\\.spec\\.ts$` and `rootDir` is `src/`, so Jest would look for files like `src/transactions/transactions.service.spec.ts` — none exist.
- Zero unit test coverage for any service, controller, guard, DTO, or utility.

**Expected location for unit tests (per NestJS convention):**
```
src/[feature]/
├── [feature].service.ts
├── [feature].service.spec.ts       # <-- co-located with source
├── [feature].controller.ts
├── [feature].controller.spec.ts    # <-- co-located with source
└── dto/
    ├── create-[entity].dto.ts
    └── create-[entity].dto.spec.ts  # <-- co-located with source
```

### E2E Tests

**Location:** `test/app.e2e-spec.ts` (29 lines)

**What it tests:**
```typescript
// test/app.e2e-spec.ts (lines 7-28)
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
```

**What's actually tested:**
- Boots the full `AppModule`
- Makes a GET request to `/`
- Expects HTTP 200 with body `'Hello World!'`

**Problems with this E2E test:**
1. **No route at `/` returns "Hello World!"** — The `HealthController` responds at `api/health`, not `/`. The default NestJS "Hello World!" response only comes from the initial scaffold and does not exist in the current `main.ts` or any controller. This test will **fail** against the current codebase unless there's a catch-all or the app is unmodified stock NestJS.
2. **Tests nothing meaningful** — It doesn't test authentication, CRUD endpoints, input parsing, rate limiting, or any business logic.
3. **No database isolation** — The test boots the full `AppModule` which connects to a real database (via `TURSO_CONNECTION_URL` env var or `file:local.db`).

---

## Test Patterns

### E2E Test Structure (from `test/app.e2e-spec.ts`)

**Setup pattern:**
```typescript
const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
}).compile();
app = moduleFixture.createNestApplication();
await app.init();
```

Uses `@nestjs/testing` `Test.createTestingModule()` with the real `AppModule` — no mocks, no overrides.

**Assertion pattern:**
```typescript
return request(app.getHttpServer())
  .get('/')
  .expect(200)
  .expect('Hello World!');
```

Uses `supertest` chained `.expect()` for status code and body matching.

**Teardown:**
```typescript
afterEach(async () => {
  await app.close();
});
```

### Mock Patterns

**No mocking patterns observed in the codebase.** The E2E test uses real modules. No unit tests exist, so no mock patterns can be documented.

**What would be needed for unit tests (not yet implemented):**
- `@nestjs/testing` `Test.createTestingModule()` with `.overrideProvider()` for mocking services
- `jest.fn()` for mock function creation
- Potential mock libraries: `jest-mock-extended` (not installed), manual mocks

---

## Coverage

### Configuration

From `package.json:89-92`:
```json
"collectCoverageFrom": ["**/*.(t|j)s"],
"coverageDirectory": "../coverage"
```

### Current State

**No coverage report available.** Since there are no unit tests (`*.spec.ts`), running `npm run test:cov` would produce 0% coverage across all files.

**Run coverage:**
```bash
npm run test:cov
# Output written to ./coverage/
```

---

## Test Gaps & Recommendations

### Critical Gaps

| Area | Missing Tests | Priority | Risk |
|------|--------------|----------|------|
| `TransactionsService` | Create, update, delete, listByMonth | **HIGH** | Core CRUD with amount negation logic, month validation, not-found errors |
| `InputService` | parseText (rule-based + LLM fallback), parseImage | **HIGH** | Complex parsing logic, regex patterns, LLM integration, fallback behavior |
| `InsightsService` | getMonthlyInsights, aggregation correctness | **HIGH** | Financial calculations (total, breakdown, daily) must be accurate |
| `CategoriesService` | list with lazy init, concurrent init handling | **MEDIUM** | Default category creation, unique constraint handling |
| `AccountService` | deleteAccount (transaction), exportData | **MEDIUM** | Cascading deletes, data export format |
| `RateLimitGuard` | User-based and IP-based rate limiting | **MEDIUM** | Rate limit enforcement, header parsing |
| All Controllers | Auth guard, parameter binding, response shapes | **MEDIUM** | Integration correctness |
| DTOs | Validation rules (required fields, min/max) | **LOW** | class-validator decorator correctness |
| E2E | Real API endpoints with auth | **HIGH** | The existing E2E test is non-functional |

### What Should Be Tested

**Unit test priorities (in order):**

1. **`TransactionsService`** (`src/transactions/transactions.service.ts`)
   - `create()`: amount negation (positive → negative), nanoid generation, note defaults to null
   - `update()`: partial updates, amount re-negation, NotFoundException
   - `delete()`: NotFoundException on missing ID
   - `listByMonth()`: invalid month format → BadRequestException, valid month filtering, default current month

2. **`InputService`** (`src/input/input.service.ts`)
   - `parseText()`: rule-based lookup via merchant map, regex amount parsing (thousands, decimals), merchant extraction, LLM fallback, LLM error graceful degradation
   - `parseImage()`: base64 handling, LLM response parsing, error fallback

3. **`InsightsService`** (`src/insights/insights.service.ts`)
   - `getMonthlyInsights()`: total calculation (absolute values), category breakdown sorting, daily expenses date sorting, empty result set

4. **`CategoriesService`** (`src/categories/categories.service.ts`)
   - `list()`: empty → lazy init, concurrent init → unique constraint re-fetch, existing categories → mapping to `CategoryResponse`

5. **`AccountService`** (`src/account/account.service.ts`)
   - `deleteAccount()`: transaction rollback on failure
   - `exportData()`: correct structure

**E2E test priorities:**

1. Replace the non-functional `/` test with real endpoint tests
2. Test `GET /api/health` → 200 with `{ status: 'ok', timestamp: ... }`
3. Test authenticated routes with a valid session
4. Test rate limiting on `/api/input/text` (expect 429 after threshold)

### Test Infrastructure Needs

- **Database mocking/override:** Tests need a way to isolate database operations (environment variable override for `TURSO_CONNECTION_URL`, in-memory SQLite, or mocked Drizzle client)
- **Auth bypass:** E2E tests need a mechanism to inject authenticated sessions
- **LLM mocking:** `InputService` tests should mock `getOpenAIClient()` to avoid real API calls
- **Redis mocking:** `RateLimitGuard` tests should mock `getRatelimitClient()` to avoid real Redis calls

---

*Testing analysis: 2026-04-26*
