# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Runner:**
- **Jest** `^30.0.0`
- **ts-jest** `^29.2.5` for TypeScript transformation
- Config: Inline in `package.json` under the `"jest"` key
  - `rootDir`: `"src"`
  - `testRegex`: `".*\\.spec\\.ts$"`
  - `testEnvironment`: `"node"`
  - `setupFilesAfterEnv`: `["<rootDir>/../test/helpers/setup.ts"]`
  - `transformIgnorePatterns`: `["node_modules/(?!(nanoid|better-auth|@thallesp/nestjs-better-auth)/)"]`

**Assertion Library:**
- Jest built-in assertions (`expect`, `toBe`, `toEqual`, `toThrow`, etc.)

**Run Commands:**
```bash
npm run test           # Run all unit tests
npm run test:watch     # Watch mode
npm run test:cov       # Run with coverage report
npm run test:debug     # Debug with Node inspector
npm run test:e2e       # Run E2E tests (jest --config ./test/jest-e2e.json)
```

## Test File Organization

**Location:**
- **Co-located** with source files
- Example: `src/transactions/transactions.service.ts` → `src/transactions/transactions.service.spec.ts`
- Utility tests also co-located: `src/lib/date-utils.spec.ts`

**Naming:**
- Pattern: `{source-file-name}.spec.ts`

**Structure:**
```
src/
├── transactions/
│   ├── transactions.controller.ts
│   ├── transactions.service.ts
│   ├── transactions.service.spec.ts
│   └── dto/
├── lib/
│   ├── date-utils.ts
│   ├── date-utils.spec.ts
│   ├── prompts.spec.ts
│   └── request-context.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: DRIZZLE, useValue: testDb as any },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(async () => {
    // Clean up database tables
  });

  describe('listByMonth', () => {
    it('should return transactions for user ordered by createdAt desc', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Patterns:**
- **Arrange-Act-Assert** structure within each `it` block
- `beforeEach` initializes the NestJS `TestingModule`
- `afterEach` truncates test data from the in-memory database
- `describe` blocks group tests by public method

## Mocking

**Framework:**
- Jest built-in mocking (`jest.mock`, `jest.fn`)

**Patterns:**

Mock external modules at the top of the spec file:
```typescript
jest.mock('../lib/redis', () => ({
  getRatelimitClient: jest.fn(),
}));
```

Mock providers in `TestingModule` using `useValue`:
```typescript
{ provide: DRIZZLE, useValue: testDb as any }
```

Mock return values inline:
```typescript
(getRatelimitClient as jest.Mock).mockReturnValue({
  limit: jest.fn().mockResolvedValue({ success: true }),
});
```

**What to Mock:**
- External infrastructure (Redis, LLM clients, auth) via `jest.mock`
- Database provider (`DRIZZLE`) is replaced with the shared `testDb` instance

**What NOT to Mock:**
- The actual SQLite database is **not mocked** — tests run against a real in-memory database
- Schema entities and Drizzle queries are executed for real

## Fixtures and Factories

**Test Data:**
- Inline helper functions within each spec file create test data
- No centralized fixture factory or `faker` library is used

Example fixture helper:
```typescript
const createTestTransaction = async (
  userId: string,
  overrides: Partial<typeof transactions.$inferInsert> = {},
) => {
  await ensureUser(userId);
  const defaults = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    amount: -35000,
    merchant: 'Cà phê',
    category: 'Ăn uống',
    source: 'text',
    createdAt: '2026-04-15T10:00:00.000Z',
    updatedAt: '2026-04-15T10:00:00.000Z',
  };
  const data = { ...defaults, ...overrides };
  await testDb.insert(transactions).values(data);
  return data;
};
```

**User setup helper:**
```typescript
const ensureUser = async (userId: string) => {
  const existing = await testDb.select().from(user).where(eq(user.id, userId));
  if (existing.length === 0) {
    await testDb.insert(user).values({
      id: userId,
      name: 'Test',
      email: `${userId}@example.com`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
};
```

**Location:**
- Helper functions are defined at the top of each `.spec.ts` file
- Shared database setup lives in `test/helpers/setup.ts`

## Database Testing Setup

**Shared Test Database:**
- File: `test/helpers/setup.ts`
- Uses `better-sqlite3` with an in-memory database (`:memory:`)
- Drizzle ORM is initialized with the full schema
- Migrations are run from `./drizzle` at import time

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/db/schema';

const sqlite = new Database(':memory:');
export const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: './drizzle' });
```

- Each spec file imports `testDb` and passes it as the `DRIZZLE` provider value
- `afterEach` blocks delete rows to ensure test isolation

## Coverage

**Configuration:**
- `collectCoverageFrom`: `["**/*.(t|j)s"]`
- `coverageDirectory`: `"../coverage"`

**Requirements:**
- No explicit coverage threshold is enforced
- CI runs tests with `--coverage=false` to speed up the pipeline
- Coverage reports are generated locally via `npm run test:cov`

**View Coverage:**
```bash
npm run test:cov
```

## Test Types

**Unit Tests:**
- Service logic tested in isolation with real database queries
- Guard logic tested with mocked execution contexts
- Utility functions tested with direct inputs/outputs
- Present in: `*.service.spec.ts`, `*.guard.spec.ts`, `*.spec.ts` (utils)

**Integration Tests:**
- Not explicitly separated. Service tests blur the line between unit and integration because they execute real SQL against SQLite.
- No HTTP-level integration tests (Supertest) are present.

**E2E Tests:**
- **Not implemented.**
- The `test:e2e` script references `./test/jest-e2e.json`, but the file does not exist.
- The `test/` directory only contains `helpers/setup.ts`.

## Common Patterns

**Async Testing:**
```typescript
it('should throw BadRequestException for invalid month format', async () => {
  await expect(
    service.listByMonth('test-user', 'bad-month'),
  ).rejects.toThrow(BadRequestException);
});
```

**Error Testing (with status verification):**
```typescript
it('should throw 429 when rate limit exceeded', async () => {
  (getRatelimitClient as jest.Mock).mockReturnValue({
    limit: jest.fn().mockResolvedValue({ success: false }),
  });

  await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

  try {
    await guard.canActivate(context);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  }
});
```

**Mock Execution Context (for Guards/Interceptors):**
```typescript
const createMockExecutionContext = (user?: { id: string }): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;
```

## CI/CD Pipeline and Quality Gates

**Pipeline:** `.github/workflows/ci.yml`

Jobs run sequentially:
1. **Lint** — `npm run lint`
2. **Test** — `npm run test -- --coverage=false` (depends on lint)
3. **Migration Check** — `npx drizzle-kit check` (depends on test)

- **Node version:** 20 (`.github/workflows/ci.yml`) — note: `package.json` specifies `node: 22.x`
- **Trigger:** Push and PR to `main` and `develop`
- **Quality Gates:** Lint and unit tests must pass. No coverage gate.

## Notable Test Utilities or Helpers

- `test/helpers/setup.ts` — Shared in-memory SQLite database with migrations
- Inline `ensureUser()` and `createTestTransaction()` helpers in multiple spec files
- `jest.clearAllMocks()` in `beforeEach` for guard tests

## Testing Conventions and Patterns

- Use `Test.createTestingModule()` from `@nestjs/testing` to build the module under test
- Always clean database tables in `afterEach` to prevent state leakage
- Use `describe` to group tests by the method being tested
- Use `it('should ...')` for test case descriptions
- Prefer `rejects.toThrow` for async exception assertions
- When asserting on exception properties (status code), use `try/catch` with `expect` inside the catch block

## Known Testing Challenges or Gaps

**Missing E2E Tests:**
- No end-to-end tests exist despite the `test:e2e` npm script
- No HTTP-level testing with Supertest for controllers
- Risk: CORS, auth middleware, and request/response serialization are not automatically verified

**Coverage Gaps:**
- Several modules lack spec files:
  - `src/transactions/transactions.controller.ts` — no controller tests
  - `src/categories/categories.service.ts` — no tests
  - `src/account/account.service.ts` — no tests
  - `src/input/input.service.ts` — no tests
  - `src/lib/timeout.interceptor.ts` — no tests
- The `checkBudgetAlert` private method in `TransactionsService` is not directly tested

**CI / Local Dev Mismatch:**
- CI runs on Node 20; `package.json` engines specify Node 22.x
- `test:e2e` script references a non-existent config file (`test/jest-e2e.json`)

**Type Safety in Tests:**
- `testDb as any` is used when providing the Drizzle database token to suppress type mismatches between `better-sqlite3` and `libsql` Drizzle instances

---

*Testing analysis: 2026-04-29*
