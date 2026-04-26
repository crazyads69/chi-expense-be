# Code Conventions

**Analysis Date:** 2026-04-26

## TypeScript Configuration

**Config files:** `tsconfig.json`, `tsconfig.build.json`

**Strictness:** Full strict mode enabled.
- `strict: true` — all strict checks active (`strictNullChecks`, `strictFunctionTypes`, etc.)
- `forceConsistentCasingInFileNames: true`
- `noFallthroughCasesInSwitch: true`
- `skipLibCheck: true` — skips type-checking of `.d.ts` files (pragmatic for monorepo/lib conflicts)
- ESLint: `recommendedTypeChecked` — full type-aware linting

**Module System:**
- `module: "nodenext"` / `moduleResolution: "nodenext"`
- `esModuleInterop: true` / `allowSyntheticDefaultImports: true`
- `resolvePackageJsonExports: true`

**Decorators:** Required by NestJS.
- `experimentalDecorators: true`
- `emitDecoratorMetadata: true`

**Target:** `ES2023`
**Output:** `declaration: true`, `removeComments: true`, `sourceMap: true`
**Incremental builds:** `incremental: true`

**Build exclusions** (from `tsconfig.build.json`): `test/`, `**/*spec.ts`

---

## Formatting (Prettier)

**Config:** `.prettierrc` (line 1-4)

| Rule | Setting |
|------|---------|
| `singleQuote` | `true` — always use single quotes in `.ts` files |
| `trailingComma` | `"all"` — trailing commas on all multi-line constructs |

**Observed in code:**
- Single quotes used throughout (`src/account/account.service.ts`, line 1: `import { Injectable, Logger } from '@nestjs/common';`)
- Trailing commas on multi-line arrays/objects/params (`src/transactions/transactions.service.ts`, lines 1-12: `Logger,` with trailing comma)
- No semicolons? Actually — semicolons ARE used (default Prettier behavior when `semi` is not overridden), consistent with the `prettier/prettier` ESLint rule at its default

**Run formatter:** `npm run format` → `prettier --write "src/**/*.ts" "test/**/*.ts"`

---

## Linting (ESLint)

**Config:** `eslint.config.mjs` (flat config, ESLint v9)

**Config layers:**
1. Ignores `eslint.config.mjs` itself
2. `eslint.configs.recommended` — base JS rules
3. `...tseslint.configs.recommendedTypeChecked` — full type-aware TypeScript rules (uses `projectService: true`)
4. `eslintPluginPrettierRecommended` — Prettier integration (runs Prettier as an ESLint rule)
5. Custom rules object

**Notable rule overrides:**

| Rule | Level | Reason |
|------|-------|--------|
| `@typescript-eslint/no-explicit-any` | **off** | Permissive — `any` is allowed (e.g., `(cachedServer as any)(req, res)` in `src/main.ts:53`, `Record<string, any>` in `src/transactions/transactions.service.ts:68`) |
| `@typescript-eslint/no-floating-promises` | **warn** | Warns but doesn't block on unawaited promises |
| `@typescript-eslint/no-unsafe-argument` | **warn** | Warns on potentially unsafe argument types |
| `prettier/prettier` | **error** with `endOfLine: "auto"` | Formatting enforced as lint error |

**Run linter:** `npm run lint` → `eslint "{src,apps,libs,test}/**/*.ts" --fix`

---

## Module Conventions

**Standard module file structure** (observed across all 5 feature modules):

```
src/[feature]/
├── [feature].module.ts      # NestJS module definition
├── [feature].controller.ts  # HTTP route handlers
├── [feature].service.ts     # Business logic
└── dto/                     # (optional) Request DTOs
    ├── create-[entity].dto.ts
    └── update-[entity].dto.ts
```

**Module files** follow a consistent pattern:

```typescript
// src/categories/categories.module.ts (lines 1-9)
import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

- No `imports` array for simple modules (they don't depend on other modules)
- No `exports` array (services aren't consumed cross-module)
- All 5 modules (`account`, `categories`, `transactions`, `input`, `insights`) follow this identical structure
- Modules are registered in `src/app.module.ts` (lines 37-41)

**Modules that have DTOs:**
- `src/transactions/dto/` — `create-transaction.dto.ts`, `update-transaction.dto.ts`
- `src/input/dto/` — `text-input.dto.ts`, `image-input.dto.ts`

**Modules without DTOs:** `account`, `categories`, `insights` (these accept only query/path params, no request body)

---

## Controller Conventions

### Route Prefixes

All controllers use the `@Controller('api/[resource]')` pattern:

| Controller | Prefix | File |
|-----------|--------|------|
| `HealthController` | `api` | `src/health.controller.ts:4` |
| `AccountController` | `api/account` | `src/account/account.controller.ts:5` |
| `CategoriesController` | `api/categories` | `src/categories/categories.controller.ts:5` |
| `TransactionsController` | `api/transactions` | `src/transactions/transactions.controller.ts:16` |
| `InputController` | `api/input` | `src/input/input.controller.ts:8` |
| `InsightsController` | `api/insights` | `src/insights/insights.controller.ts:5` |

### Decorator Usage

**Session / Auth:**
```typescript
// src/account/account.controller.ts (line 2)
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
// Usage: @Session() session: UserSession
// Access user ID: session.user.id
```
Every controller method that requires authentication uses `@Session()` to extract the user session.

**Public routes:**
```typescript
// src/health.controller.ts (line 8)
@AllowAnonymous()  // from @thallesp/nestjs-better-auth
@Get('health')
```

**HTTP method decorators:**
- `@Get()`, `@Get(':id')`, `@Get('export')` — read operations
- `@Post()`, `@Post('text')`, `@Post('image')` — create/action operations
- `@Patch(':id')` — partial updates
- `@Delete()`, `@Delete(':id')` — delete operations

**Parameter decorators:**
```typescript
// src/transactions/transactions.controller.ts (lines 21-44)
@Get()
async list(@Session() session: UserSession, @Query('month') month?: string) { ... }

@Post()
async create(@Session() session: UserSession, @Body() dto: CreateTransactionDto) { ... }

@Patch(':id')
async update(@Session() session: UserSession, @Param('id') id: string, @Body() dto: UpdateTransactionDto) { ... }
```

**Guard decorators:**
```typescript
// src/input/input.controller.ts (lines 12, 18)
@UseGuards(RateLimitGuard)  // Applied per-route for LLM endpoints
```

### Response Patterns

Controllers return plain objects or delegate to service methods directly. No explicit `@Res()` or manual response handling:

```typescript
// src/account/account.controller.ts (line 12)
return { success: true };

// src/transactions/transactions.controller.ts (line 22)
return this.transactionsService.listByMonth(session.user.id, month);

// src/categories/categories.controller.ts (line 11)
return await this.categoriesService.list(session.user.id);
```

### Error Handling

Controllers do NOT wrap code in try/catch. They rely on NestJS exception filters:
- Services throw `BadRequestException`, `NotFoundException` (from `@nestjs/common`)
- Guards throw `HttpException` (e.g., `src/input/rate-limit.guard.ts:35`)
- The global `ValidationPipe` handles DTO validation errors automatically

---

## Service Conventions

### Structure

```typescript
// src/transactions/transactions.service.ts (lines 14-16)
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  // ... methods
}
```

### Database Access

Services import `db` directly from `../db/client` (a module-level singleton):

```typescript
// src/account/account.service.ts (line 2)
import { db } from '../db/client';

// src/categories/categories.service.ts (line 2)
import { db } from '../db/client';
```

No repository pattern — services call Drizzle ORM directly:

```typescript
// Select
const result = await db.select().from(transactions).where(eq(transactions.userId, userId));

// Insert with returning
const [result] = await db.insert(transactions).values({ ... }).returning();

// Update with returning
const [result] = await db.update(transactions).set(data).where(...).returning();

// Delete with returning
const [result] = await db.delete(transactions).where(...).returning();

// Transaction (src/account/account.service.ts:12)
await db.transaction(async (tx) => {
  await tx.delete(transactions).where(eq(transactions.userId, userId));
  await tx.delete(categories).where(eq(categories.userId, userId));
  // ...
});
```

### Error Handling in Services

Services throw NestJS exceptions for validation and not-found cases:

```typescript
// src/transactions/transactions.service.ts (lines 18-19)
if (month && !/^\d{4}-\d{2}$/.test(month)) {
  throw new BadRequestException('Invalid month format. Expected YYYY-MM');
}

// src/transactions/transactions.service.ts (lines 83-88)
if (!result) {
  this.logger.warn(`Update failed: Transaction ${id} not found for user ${userId}`);
  throw new NotFoundException(`Transaction with id ${id} not found`);
}
```

Services also handle concurrent initialization errors:

```typescript
// src/categories/categories.service.ts (lines 52-63)
catch (error: unknown) {
  const err = error as Error;
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    this.logger.warn(`Categories already initialized for user: ${userId} by a concurrent request.`);
    return await this.list(userId); // Re-fetch
  }
  throw error;
}
```

LLM errors are caught and logged with graceful fallbacks:

```typescript
// src/input/input.service.ts (lines 114-119)
} catch (error) {
  this.logger.error('LLM parsing failed', error instanceof Error ? error.stack : error);
}
// Falls through to return default parsed values
```

### Return Types

Services return:
- Drizzle query results directly (e.g., `src/transactions/transactions.service.ts:64`)
- Plain objects: `{ success: true }` (e.g., `src/account/account.service.ts:28`)
- Interfaces/types for parsed data (e.g., `ParsedExpense` in `src/input/input.service.ts:13-18`)
- TypeScript interfaces exported for external use (e.g., `CategoryResponse` in `src/categories/categories.service.ts:18-23`)

---

## DTO Conventions

### class-validator Decorators

**In use across the codebase:**

| Decorator | Usage | Example |
|-----------|-------|---------|
| `@IsInt()` | Integer validation | `src/transactions/dto/create-transaction.dto.ts:12` |
| `@IsString()` | String validation | `src/transactions/dto/create-transaction.dto.ts:16` |
| `@IsOptional()` | Optional fields | `src/transactions/dto/create-transaction.dto.ts:29` |
| `@IsNotEmpty()` | Required non-empty string | `src/transactions/dto/create-transaction.dto.ts:17` |
| `@IsIn([...])` | Enum-like constraint | `src/transactions/dto/create-transaction.dto.ts:26` |
| `@Min(1)` | Minimum value (amount > 0) | `src/transactions/dto/create-transaction.dto.ts:13` |
| `@MaxLength(N)` | String max length | `src/transactions/dto/create-transaction.dto.ts:18` (255), line 23 (100), line 31 (1000) |

### DTO Design Patterns

**Create DTOs** have required fields with `!` definite assignment assertion:

```typescript
// src/transactions/dto/create-transaction.dto.ts (lines 11-33)
export class CreateTransactionDto {
  @IsInt()
  @Min(1)
  amount!: number;  // Required, no @IsOptional()

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  merchant!: string;  // Required
  // ...
}
```

**Update DTOs** have all fields marked `@IsOptional()`:

```typescript
// src/transactions/dto/update-transaction.dto.ts (lines 3-23)
export class UpdateTransactionDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  amount?: number;  // Optional with ? syntax

  @IsString()
  @MaxLength(255)
  @IsOptional()
  merchant?: string;
  // ...
}
```

**Note:** `CreateTransactionDto` uses `!` (definite assignment) while `UpdateTransactionDto` uses `?` (optional). The `!` is used because class-validator doesn't see the field at construction time but it will be populated by class-transformer via `@Body()`.

### class-transformer Integration

The `ValidationPipe` in `src/main.ts:23-29` enables:
- `whitelist: true` — strips unknown properties
- `transform: true` — transforms plain objects to class instances (enables `@Type()` and implicit conversion)
- `forbidNonWhitelisted: true` — throws error for unknown properties

---

## Import Conventions

### Import Order

No rigid ordering enforced by ESLint, but observed pattern across all files:

1. NestJS core (`@nestjs/common`, `@nestjs/core`)
2. Third-party NestJS packages (`@thallesp/nestjs-better-auth`, `nestjs-pino`)
3. Third-party libraries (`drizzle-orm`, `nanoid`, `openai`)
4. Local modules (relative paths `../db/client`, `../lib/auth`)

**No path aliases used** — all imports are relative (e.g., `../../db/client` in `src/transactions/transactions.service.ts:7`, `../db/client` in `src/account/account.service.ts:2`).

### Import Style

- Named imports exclusively (no default imports except for `import OpenAI from 'openai'` in `src/lib/openrouter.ts:1`)
- Type-only imports use `type` keyword: `import { Session, type UserSession } from '@thallesp/nestjs-better-auth';` (e.g., `src/account/account.controller.ts:2`)
- Wildcard imports used only for `import * as dotenv from 'dotenv'` in `src/main.ts:1` and `import * as schema from './schema'` in `src/db/client.ts:3`

---

## Naming Conventions

### Files and Directories

| Convention | Pattern | Examples |
|-----------|---------|---------|
| Module files | `[name].module.ts` | `transactions.module.ts`, `account.module.ts` |
| Controller files | `[name].controller.ts` | `transactions.controller.ts`, `health.controller.ts` |
| Service files | `[name].service.ts` | `transactions.service.ts`, `input.service.ts` |
| DTO files | `[dto-name].dto.ts` | `create-transaction.dto.ts`, `text-input.dto.ts` |
| Guard files | `[name].guard.ts` | `rate-limit.guard.ts` |
| Library/config files | `[name].ts` | `auth.ts`, `openrouter.ts`, `redis.ts`, `prompts.ts`, `merchant-table.ts` |
| DB files | `client.ts`, `schema.ts` | `src/db/client.ts`, `src/db/schema.ts` |

All files use **kebab-case** (lowercase with hyphens).

### Classes

| Convention | Pattern | Examples |
|-----------|---------|---------|
| Modules | `[Name]Module` PascalCase | `TransactionsModule`, `InsightsModule` |
| Controllers | `[Name]Controller` PascalCase | `TransactionsController`, `HealthController` |
| Services | `[Name]Service` PascalCase | `TransactionsService`, `InputService` |
| Guards | `[Name]Guard` PascalCase | `RateLimitGuard` |
| DTOs | `[Action][Entity]Dto` PascalCase | `CreateTransactionDto`, `UpdateTransactionDto`, `TextInputDto`, `ImageInputDto` |

### Variables and Functions

- **camelCase** throughout
- Logger instances: `private readonly logger = new Logger(ClassName.name);`
- Private methods: `private lookupMerchant(...)` (e.g., `src/input/input.service.ts:23`)
- Constants: `UPPER_SNAKE_CASE` for module-level constants (`MAX_MESSAGE_LENGTH`, `LLM_TEMPERATURE` in `src/input/input.service.ts:6-11`)
- Default data maps: `DEFAULT_CATEGORIES` in `src/categories/categories.service.ts:7`

### Route Paths

- **kebab-case** for path segments: `api/transactions`, `api/categories`, not `api/Transactions`
- Resource-based naming: plural for collections (`transactions`, `categories`, `insights`)
- Action sub-paths: `api/account/export`, `api/input/text`, `api/input/image`
- Route params: `:id` (e.g., `@Patch(':id')` in `src/transactions/transactions.controller.ts:33`)

---

## Error Handling Patterns

### Layer Responsibilities

| Layer | Pattern | File |
|-------|---------|------|
| **Controller** | No try/catch; delegates to service | All controllers |
| **Service** | Throws `BadRequestException` for validation, `NotFoundException` for missing resources | `src/transactions/transactions.service.ts:19,87` |
| **Guard** | Throws `HttpException` for access control | `src/input/rate-limit.guard.ts:35,45` |
| **DTO Validation** | Automatic via `ValidationPipe` — 400 on validation failure | `src/main.ts:23-29` |
| **LLM/External** | Try/catch with graceful default fallback | `src/input/input.service.ts:114-119,178-183` |

### Logging on Error

Services log before/after errors:

```typescript
// src/transactions/transactions.service.ts (lines 84-86) — warn before throwing
if (!result) {
  this.logger.warn(`Update failed: Transaction ${id} not found for user ${userId}`);
  throw new NotFoundException(`Transaction with id ${id} not found`);
}

// src/input/input.service.ts (lines 115-118) — error with stack trace
catch (error) {
  this.logger.error('LLM parsing failed', error instanceof Error ? error.stack : error);
}
```

### Graceful Degradation

The `InputService` (`src/input/input.service.ts`) demonstrates a fallback pattern:
1. Try LLM parsing
2. If LLM fails → log error → return rule-based parsed result
3. Never throws — always returns a `ParsedExpense`

---

## NestJS-Specific Conventions

### Module Registration

All feature modules registered in `src/app.module.ts` (lines 37-41):
```typescript
TransactionsModule, InsightsModule, CategoriesModule, InputModule, AccountModule
```

### Global Configuration

Set up in `src/main.ts` bootstrap:
- **CORS:** `enableCors()` with permissive origin (line 31-36)
- **Helmet:** `app.use(helmet())` for security headers (line 21)
- **ValidationPipe:** Global pipe with whitelist, transform, forbidNonWhitelisted (lines 23-29)
- **Logger:** `app.useLogger(app.get(Logger))` using nestjs-pino (line 18)
- **ConfigModule:** `ConfigModule.forRoot({ isGlobal: true })` in `src/app.module.ts:15`

### Guard Usage

- Only one custom guard: `RateLimitGuard` (`src/input/rate-limit.guard.ts`)
- Applied per-route via `@UseGuards(RateLimitGuard)` in `src/input/input.controller.ts:12,18`
- Auth guard is implicit via `@thallesp/nestjs-better-auth` middleware — all routes are protected by default
- `@AllowAnonymous()` is used to exempt specific routes (e.g., health check in `src/health.controller.ts:8`)

### Pipe Usage

- Global `ValidationPipe` only — no parameter-level pipes
- No `@UsePipes()` decorator used anywhere

### Dependency Injection

- All services injected via constructor:
  ```typescript
  // src/account/account.controller.ts (line 7)
  constructor(private readonly accountService: AccountService) {}
  ```
- All services and controllers use `private readonly` for injected dependencies
- No custom providers or `@Inject()` usage

### Serverless / Vercel Pattern

`src/main.ts` exports a serverless handler (lines 45-54):
```typescript
export default async function handler(req: Request, res: Response): Promise<void> {
  if (!cachedServer) { cachedServer = await bootstrap(); }
  (cachedServer as any)(req, res);
}
```
And also auto-starts Express locally when not in Vercel (lines 57-67).

---

## Database Access Conventions

### Drizzle ORM Patterns

**Client initialization** (`src/db/client.ts`):
```typescript
const client = createClient({
  url: process.env.TURSO_CONNECTION_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});
export const db = drizzle(client, { schema });
```

**Schema definition** (`src/db/schema.ts`):
- Uses `sqliteTable` from `drizzle-orm/sqlite-core`
- All IDs are `text('id').primaryKey()`
- nanoid-generated IDs (not auto-increment)
- `created_at` columns use ISO string timestamps for app tables, timestamp_ms for auth tables
- Foreign keys defined with `.references(() => otherTable.id, { onDelete: 'cascade' })`
- Indexes defined inline in table second argument
- Type exports: `$inferSelect` and `$inferInsert` types exported at bottom (lines 135-138)

**Query patterns:**
```typescript
// Select with where
db.select().from(transactions).where(eq(transactions.userId, userId))

// Select specific columns
db.select({ amount: transactions.amount, category: transactions.category, createdAt: transactions.createdAt })
  .from(transactions).where(...)

// Compound conditions
and(eq(transactions.userId, userId), like(transactions.createdAt, `${targetMonth}%`))

// Ordering
.orderBy(desc(transactions.createdAt))

// Insert with returning
db.insert(transactions).values({ ... }).returning()

// Update with returning
db.update(transactions).set(updateData).where(...).returning()

// Delete with returning
db.delete(transactions).where(...).returning()

// Transaction block
db.transaction(async (tx) => { /* tx.delete, tx.insert, etc. */ })
```

### Date Filtering Pattern

Instead of parsing dates in code, the codebase uses ISO string prefix matching with `LIKE`:

```typescript
// src/transactions/transactions.service.ts (line 33)
like(transactions.createdAt, `${targetMonth}%`)  // e.g., "2026-04%"
```

This is documented as a performance optimization relying on the compound index `idx_transactions_user_createdAt` on `(user_id, created_at)`.

---

## Logging Conventions

**Framework:** nestjs-pino (Pino under the hood)

**Logger instance pattern:**
```typescript
// Every service and controller
private readonly logger = new Logger(ClassName.name);
```

**Logger import** (from `@nestjs/common`, not `nestjs-pino`):
```typescript
import { Injectable, Logger } from '@nestjs/common';
```

**Log levels used:**
| Level | Usage | Example |
|-------|-------|---------|
| `log` | Normal operations | `src/transactions/transactions.service.ts:63` — "Created transaction..." |
| `warn` | Expected errors (not found, concurrent) | `src/transactions/transactions.service.ts:84` — "Update failed..." |
| `error` | Unexpected failures | `src/input/input.service.ts:115` — "LLM parsing failed" |

**Pino configuration** (`src/app.module.ts:16-31`):
- `level`: `'debug'` in non-production, `'info'` in production
- `transport`: `pino-pretty` in development (human-readable), JSON in production
- Redaction on: `authorization`, `cookie`, `x-better-auth-session` headers

---

*Convention analysis: 2026-04-26*
