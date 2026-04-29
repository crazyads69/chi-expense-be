# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- Source files use **kebab-case**: `transactions.service.ts`, `create-transaction.dto.ts`, `rate-limit.guard.ts`
- Test files are co-located and use the pattern `{name}.spec.ts`
- Configuration files at the root use standard names: `eslint.config.mjs`, `.prettierrc`, `tsconfig.json`

**Classes:**
- **PascalCase** for all class names
- Services: `{Feature}Service` (e.g., `TransactionsService`, `InsightsService`)
- Controllers: `{Feature}Controller` (e.g., `HealthController`)
- Guards: `{Feature}Guard` (e.g., `RateLimitGuard`)
- Interceptors: `{Feature}Interceptor` (e.g., `TimeoutInterceptor`)
- DTOs: `{Action}{Feature}Dto` (e.g., `CreateTransactionDto`, `UpdateTransactionDto`)
- Modules: `{Feature}Module` (e.g., `DatabaseModule`)

**Functions / Methods:**
- **camelCase** for all functions and methods
- Utility functions are named descriptively: `parseMonth()`, `getMonthBoundaries()`, `nowISO()`
- Private helper methods on services: `checkBudgetAlert()`

**Variables / Properties:**
- **camelCase** for variables and properties
- Constants and injection tokens use **SCREAMING_SNAKE_CASE**: `DRIZZLE`
- Private readonly class properties use leading underscore only when necessary (not commonly used here)

**Types / Interfaces:**
- **PascalCase** for type aliases and interfaces
- `interface RequestContext { ... }`
- `type DrizzleDatabase = LibSQLDatabase<typeof schema>`
- Inferred insert types use `$inferInsert`: `typeof transactions.$inferInsert`

## Code Style

**Formatting:**
- Tool: **Prettier** (`^3.4.2`)
- Config: `.prettierrc`
  - `singleQuote: true`
  - `trailingComma: "all"`
- The ESLint Prettier plugin enforces formatting as an error (`"prettier/prettier": ["error", { endOfLine: "auto" }]`)

**Linting:**
- Tool: **ESLint** 9 with flat config (`eslint.config.mjs`)
- Extends:
  - `eslint.configs.recommended`
  - `tseslint.configs.recommendedTypeChecked`
  - `eslintPluginPrettierRecommended`
- Key rules:
  - `@typescript-eslint/no-explicit-any`: `off`
  - `@typescript-eslint/no-floating-promises`: `warn`
  - `@typescript-eslint/no-unsafe-argument`: `warn`
- Globals configured for Node.js and Jest environments
- Lint command: `npm run lint` (auto-fix enabled via `--fix`)

## Import Organization

**Order:**
1. Standard library imports (e.g., `async_hooks`)
2. Third-party framework imports (e.g., `@nestjs/common`, `drizzle-orm`)
3. Third-party utility imports (e.g., `nanoid`, `helmet`)
4. Internal absolute/relative imports

**Path Aliases:**
- `baseUrl` is set to `"./"` in `tsconfig.json`
- The codebase mixes **non-relative root imports** (`import { transactions } from 'src/db/schema'`) with **relative imports** (`import { DRIZZLE } from '../db/db-token'`)
- **Convention:** Prefer relative imports (`../`) for files within the same feature module; avoid mixing styles within a single file

**Type Imports:**
- Use explicit `import type` when importing only types:
  ```typescript
  import type { DrizzleDatabase } from '../db/db-token';
  import type { Request, Response } from 'express';
  ```

## TypeScript Usage Patterns

**Strictness:**
- `strict: true` is enabled in `tsconfig.json`
- `moduleResolution: "nodenext"` with `module: "nodenext"`
- `isolatedModules: true`
- `forceConsistentCasingInFileNames: true`
- `noFallthroughCasesInSwitch: true`
- `skipLibCheck: true`

**Types vs Interfaces:**
- `interface` is used for object shapes that may be extended (e.g., `RequestContext`)
- `type` is used for aliases and inferred schema types (e.g., `DrizzleDatabase`, `typeof transactions.$inferInsert`)
- DTOs are implemented as **classes** with decorators (`class-validator` + `@nestjs/swagger`) rather than interfaces

**Non-null assertion:**
- Used frequently in DTOs and config validation classes: `BETTER_AUTH_SECRET!: string`

**Any usage:**
- `@typescript-eslint/no-explicit-any` is turned off
- `any` is used pragmatically for database client injection in controllers: `private readonly db: any`
- Test files cast the test DB: `useValue: testDb as any`

## Error Handling

**Patterns:**
- **NestJS HTTP Exceptions** are the primary error mechanism:
  - `NotFoundException` — resource not found
  - `BadRequestException` — invalid input data
  - `ServiceUnavailableException` — health check failures or shutdown state
  - `HttpException(message, status)` — generic cases (e.g., rate limiting)
- **Global Filter:** `SentryGlobalFilter` is registered as `APP_FILTER` in `AppModule` to capture and report unhandled exceptions
- Services throw exceptions directly; controllers do not wrap them
- Non-blocking async operations use `.catch()` with logging instead of `await`:
  ```typescript
  this.checkBudgetAlert(userId, dto.category).catch((err) => {
    this.logger.error(`Budget alert check failed: ${err.message}`, err.stack);
  });
  ```
- Local `try/catch` blocks are used for health checks and optional operations where failure should not crash the request

## Async / Await

- **Async/await is used exclusively.** No callback patterns are present.
- `Promise<T>` return types are implicit via `async` functions.
- RxJS `Observable` is used only in interceptors (`TimeoutInterceptor`).

## Comments and Documentation

**JSDoc:**
- Utility functions in `src/lib/date-utils.ts` use JSDoc block comments to explain purpose, parameters, and return values
- Not used exhaustively across the codebase; focused on shared utilities

**Inline Comments:**
- Used to explain business logic decisions:
  ```typescript
  // As per spec, expenses are stored as negative amounts internally if they are outflows
  // But the DTO only accepts positive integers (@Min(1)) to prevent UI logic errors.
  ```

**Swagger / OpenAPI:**
- Controllers and DTOs are documented with `@nestjs/swagger` decorators (`@ApiOperation`, `@ApiResponse`, `@ApiProperty`)
- This serves as the live API documentation source

## Commit Message Conventions

- **Not detected.** No `commitlint`, `.commitlintrc`, or Husky configuration is present.
- Standard Git conventions are assumed.

## Module Design

**Exports:**
- Services, controllers, and DTOs are exported as named exports
- Symbols used for DI are exported as constants: `export const DRIZZLE = Symbol('DRIZZLE')`

**Barrel Files:**
- Not used. Imports reference files directly.

**DI Patterns:**
- Constructor injection is standard
- Custom providers use `useFactory` for database client creation
- Global modules (`@Global()`) are used for `DatabaseModule`

## Function Design

**Size:**
- Service methods are generally focused (e.g., `listByMonth`, `create`, `update`, `delete`)
- Private helper methods extracted for non-blocking side effects (e.g., `checkBudgetAlert`)

**Parameters:**
- DTOs are used for request bodies instead of raw objects
- Optional parameters use TypeScript optional syntax (`month?: string`)
- Default parameter values are used for pagination (`page: number = 1`)

---

*Convention analysis: 2026-04-29*
