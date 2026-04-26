# Architecture Patterns — Production Hardening

**Domain:** NestJS 11 serverless API hardening
**Researched:** 2026-04-26

## Recommended Architecture

The hardening layer wraps the existing NestJS monolith with cross-cutting concerns: testing isolation, error monitoring, analytics, API documentation, and CI quality gates. No new architectural boundaries — concerns are implemented as NestJS providers, middleware, and decorators.

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Serverless Function                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    handler(req, res)                   │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │          cached Express instance (singleton)     │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │
│  │  │  │         NestJS Application                 │  │  │
│  │  │  │                                           │  │  │
│  │  │  │  ┌─────────────────────────────────────┐  │  │  │
│  │  │  │  │    Sentry.init() — before bootstrap  │  │  │  │
│  │  │  │  │    ConfigModule.forRoot({ validate }) │  │  │  │
│  │  │  │  │    helmet() + compression()          │  │  │  │
│  │  │  │  └─────────────────────────────────────┘  │  │  │
│  │  │  │                                           │  │  │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │  │
│  │  │  │  │Sentry    │  │PostHog   │  │Swagger │ │  │  │
│  │  │  │  │Global    │  │Module    │  │Module  │ │  │  │
│  │  │  │  │Filter    │  │(lazy)    │  │(dev)   │ │  │  │
│  │  │  │  └──────────┘  └──────────┘  └────────┘ │  │  │
│  │  │  │                                           │  │  │
│  │  │  │  ┌──────────────┐  ┌────────────────┐    │  │  │
│  │  │  │  │ Controllers  │  │ Rate Limit     │    │  │  │
│  │  │  │  │(@Session,    │  │ Guard          │    │  │  │
│  │  │  │  │ @ApiTags,    │  │ (Upstash Redis)│    │  │  │
│  │  │  │  │ @SentryTraced│  └────────────────┘    │  │  │
│  │  │  │  └──────┬───────┘                        │  │  │
│  │  │  │         │                                │  │  │
│  │  │  │  ┌──────▼───────┐  ┌──────────────┐     │  │  │
│  │  │  │  │  Services    │  │ Drizzle ORM   │     │  │  │
│  │  │  │  │(@SentryTraced│  │ (production:  │     │  │  │
│  │  │  │  │ on LLM ops)  │  │  @libsql)     │     │  │  │
│  │  │  │  └──────────────┘  └──────────────┘     │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │
│  │  └─────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘

                              ┌────────────────────┐
                              │   GitHub Actions   │
                              │  lint → type-check │
                              │  → test → test:e2e │
                              └────────┬───────────┘
                                       │ blocks merge on failure
                              ┌────────▼───────────┐
                              │  Vercel Git Deploy  │
                              │  Preview (PR) →     │
                              │  Production (main)  │
                              └────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Testing Architecture                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Test.createTestingModule({                           │  │
│  │    imports: [AppModule],                              │  │
│  │  })                                                   │  │
│  │  .overrideProvider('DB_CLIENT')   ← production client  │  │
│  │  .useFactory(() => {                                   │  │
│  │    const sqlite = new Database(':memory:');  ← test DB │  │
│  │    return drizzle(sqlite, { schema });                 │  │
│  │  })                                                   │  │
│  │  .compile();                                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Sentry init** (instrument.ts) | Initialize Sentry before NestJS bootstrap. Source maps, release tracking. | Sentry Cloud |
| **Env Validation** (env.validation.ts) | Parse + validate all env vars at ConfigModule init. Fail fast with clear message. | ConfigModule |
| **SentryGlobalFilter** | Catch all unhandled exceptions. Report to Sentry before returning 500. | Exception layer, Sentry Cloud |
| **PostHog client** (lib/posthog.ts) | Lazy-initialized singleton. Event capture with immediate flush for serverless. | PostHog Cloud |
| **SwaggerModule** (main.ts) | Generate OpenAPI spec + serve Swagger UI. Dev-only (gated by NODE_ENV). | Controllers, DTOs |
| **Test helpers** (test/helpers/) | In-memory database setup, schema creation, seed data, test factory functions. | Jest, better-sqlite3 |
| **GitHub Actions CI** (.github/workflows/) | Lint → type-check → unit test → e2e test pipeline. Block merge on failure. | GitHub, Vercel |
| **Commitlint** (commitlint.config.js) | Enforce conventional commit format. Husky `commit-msg` hook. | Git, Husky |

### Data Flow — Error Monitoring

```
1. Service throws error (e.g., LLM API timeout)
2. Error propagates up through controller → NestJS exception layer
3. SentryGlobalFilter intercepts the exception
4. Sentry SDK attaches breadcrumbs (Pino logs, request context, user session)
5. Error reported to Sentry with stack trace, request payload, user context
6. HTTP 500 response returned to client (with Sentry event ID for debugging)
7. Developer receives Slack/email alert from Sentry
```

### Data Flow — Product Analytics

```
1. User submits expense text → POST /api/input/text
2. Controller calls InputService.parseText()
3. After successful parse: posthog.capture({ distinctId, event: 'expense_created',
   properties: { source: 'text', category, amount } })
4. On parse failure: posthog.capture({ distinctId, event: 'parsing_failed',
   properties: { source: 'text', error_type } })
5. Event sent to PostHog via HTTPS (immediate flush — no batching for serverless)
6. PostHog dashboards show: text vs image usage, fail rates, popular categories, power users
```

## Patterns to Follow

### Pattern 1: Database Provider Override for Tests

**What:** Swap the production `@libsql/client` Drizzle instance with a `better-sqlite3` in-memory instance when running tests. Use NestJS custom provider tokens.

**When:** Every test file that interacts with the database.

**Example:**
```typescript
// src/db/db.provider.ts — define an injectable token
export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT';

export const databaseProvider = {
  provide: DRIZZLE_CLIENT,
  useFactory: () => {
    const client = createClient({
      url: process.env.TURSO_CONNECTION_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    return drizzle(client, { schema });
  },
};
```

```typescript
// test/helpers/setup.ts — test database factory
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';

export function createTestDatabase() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  // Run schema creation (migrations or inline SQL)
  return db;
}
```

```typescript
// *.spec.ts — using the override
const moduleRef = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(DRIZZLE_CLIENT)
  .useFactory({
    factory: () => createTestDatabase(),
  })
  .compile();
```

**Rationale:** The current architecture has `db` as a module-level singleton (`src/db/client.ts:11`), making it impossible to inject a mock. This refactor is NECESSARY before any database-touching tests can be written. The provider token pattern is the NestJS-standard way to make dependencies injectable.

### Pattern 2: Lazy External Client Initialization

**What:** Initialize external SDK clients (Sentry, PostHog, Upstash Redis) lazily on first use, not at module import time. Compatible with Vercel serverless cold starts.

**When:** Any external client that has an initialization cost or may be unavailable at bootstrap.

**Example (already in use for Redis — mirror for PostHog):**
```typescript
// src/lib/posthog.ts
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

export function getPostHog(): PostHog {
  if (!client) {
    if (!process.env.POSTHOG_API_KEY) {
      return createNoopPostHog();  // no-op in dev/test
    }
    client = new PostHog(process.env.POSTHOG_API_KEY, {
      host: 'https://eu.i.posthog.com',
      flushAt: 1,       // send immediately (serverless-safe)
      flushInterval: 0,
    });
  }
  return client;
}
```

### Pattern 3: Environment Validation at ConfigModule Init

**What:** Validate ALL required environment variables at NestJS module initialization time. App fails to start with a descriptive error if any are missing.

**When:** Always. This replaces the current behavior where missing env vars cause cryptic runtime errors minutes/hours into operation.

**Example:** See STACK.md Section 5 for the full `EnvironmentVariables` class with `validate()` function.

### Pattern 4: Sentry Tracing on LLM-Intensive Operations

**What:** Use `@SentryTraced()` decorator on methods that involve external API calls (OpenRouter). Provides latency histograms in Sentry dashboards.

**When:** On all methods that call external APIs, especially LLM operations.

**Example:**
```typescript
import { SentryTraced } from '@sentry/nestjs';

@Injectable()
export class InputService {
  @SentryTraced('parseTextViaLLM')
  private async callLLMForText(message: string): Promise<ParsedExpense> {
    // OpenRouter API call
  }

  @SentryTraced('parseImageViaLLM')
  private async callLLMForImage(base64Image: string): Promise<ParsedExpense> {
    // OpenRouter vision API call
  }
}
```

### Pattern 5: Health Checks with Dependency Verification

**What:** Use `@nestjs/terminus` to verify database, Redis, and optionally LLM API connectivity in the health endpoint. Differentiate between "app is running" and "app is functional."

**When:** Health endpoint (`GET /api/health`). Provides deployment confidence and debugging signal.

**Example:**
```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicator } from '@nestjs/terminus';

@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
  constructor(@Inject(DRIZZLE_CLIENT) private db: DrizzleClient) { super(); }
  async pingCheck(key: string) {
    try {
      await this.db.select().from(user).limit(1);
      return this.getStatus(key, true);
    } catch (e) {
      return this.getStatus(key, false, { message: e.message });
    }
  }
}

@Controller('api/health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DrizzleHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Module-Level Side Effects in Test Code

**What:** Creating database connections, initializing SDKs, or making network calls at module import time in test files.

**Why bad:** Tests run in parallel. Module-level side effects cause port conflicts, shared state pollution, and flaky tests.

**Instead:** Initialize in `beforeAll()` / `beforeEach()` hooks. Clean up in `afterAll()` / `afterEach()`.

### Anti-Pattern 2: Real External APIs in Tests

**What:** Tests calling the real OpenRouter API, real Turso database, real Upstash Redis.

**Why bad:** Tests become slow (LLM calls take seconds), flaky (network issues), and expensive (API costs). They also fail in CI without credentials.

**Instead:** Mock external boundaries. Use in-memory SQLite for DB. Use `jest.fn()` for HTTP calls.

### Anti-Pattern 3: Observability Initialization in NestJS Module Constructor

**What:** Initializing Sentry or PostHog inside a NestJS module constructor or provider factory.

**Why bad:** On Vercel serverless, the module may be re-initialized on each cold start but not between warm invocations. Sentry must be initialized before NestJS bootstraps (it patches the runtime).

**Instead:** Initialize Sentry in `src/instrument.ts` (imported FIRST in `main.ts`). Initialize PostHog lazily on first use (Pattern 2).

### Anti-Pattern 4: Batching Analytics Events on Serverless

**What:** Using PostHog's default batching (`flushAt: 15`, `flushInterval: 10000`) on Vercel serverless.

**Why bad:** Vercel functions are killed after the response is sent. Batched events are lost if the function terminates before the flush interval.

**Instead:** Set `flushAt: 1` (send each event immediately). This adds ~50ms per event but guarantees delivery.

### Anti-Pattern 5: Swagger UI Enabled in Production

**What:** Serving the interactive Swagger UI at `/api/docs` in production.

**Why bad:** Swagger UI is a development tool. In production it exposes the full API surface, increases bundle size, and is a minor attack surface.

**Instead:** Gate with `if (process.env.NODE_ENV !== 'production')`. In production, expose only the raw OpenAPI JSON at `/api/docs-json` for API client generation.

## Scalability Considerations

| Concern | At 100 users | At 1K users | At 10K users |
|---------|--------------|-------------|-------------|
| Sentry error volume | ~100/day → free tier (5K) handles it | ~1K/day → free tier still sufficient | ~10K/day → need Team plan ($26/mo) |
| PostHog event volume | ~500/day → free tier (1M/mo) handles it | ~5K/day → free tier sufficient | ~50K/day → need paid plan |
| Test database | `:memory:` — trivial | `:memory:` — still sufficient | CI may need temp file for parallel workers |
| Swagger spec size | <100KB → trivial | <100KB → still trivial | Split into multiple spec files if >1MB |
| GitHub Actions minutes | ~50 min/month → free (2K min) | ~200 min/month → free tier | ~2K min/month → still free for public repos |
| LLM tracing (Sentry) | `tracesSampleRate: 0.1` → 10% of LLM calls traced | Same | `tracesSampleRate: 0.01` to control transaction quota |

## Database Migrations (Integration 4)

### Current State
`drizzle.config.ts` exists but `./drizzle/` is empty — no migration files exist. Schema was likely deployed via `db push` or manual SQL.

### Required Workflow
1. Generate initial migration: `npx drizzle-kit generate --name=init` → creates SQL + snapshot
2. Commit migration files to repo (version-controlled artifacts)
3. Add scripts to `package.json`: `db:generate`, `db:migrate`, `db:migrate:check`, `db:studio`
4. Auto-run migrations on cold start via DatabaseModule factory (idempotent via drizzle-kit migrate)
5. CI gate: `npx drizzle-kit check` in GitHub Actions

### New Files
- `drizzle/0000_init.sql` — initial migration
- `drizzle/meta/0000_snapshot.json` — snapshot for future diffs
- `src/db/migrate.ts` — standalone migration runner

---

## CI/CD Pipeline (Integration 5)

### Pipeline: Lint → TypeCheck → Unit Tests → Migration Check → Build → Deploy (Vercel)
- GitHub Actions (`.github/workflows/ci.yml`) — 5 parallel jobs, build depends on all
- Vercel GitHub App auto-deploy: preview on PR, production on main push
- `vercel.json` changes: `runtime: nodejs20.x`, `maxDuration: 30`

---

## File Impact Summary

### New Files (14)
`src/db/database.module.ts`, `src/db/migrate.ts`, `src/common/common.module.ts`, `src/common/all-exceptions.filter.ts`, `src/common/timeout.interceptor.ts`, `src/health/health.module.ts`, `src/health/health.controller.ts`, `src/health/database.health.ts`, `src/health/redis.health.ts`, `.github/workflows/ci.yml`, `drizzle/0000_init.sql`, `drizzle/meta/0000_snapshot.json`, `test/helpers/setup.ts`, `test/helpers/seed.ts`

### Modified Files (18)
`src/app.module.ts` (new imports, env validation), `src/main.ts` (Swagger, Sentry, remove dotenv), `src/db/client.ts` (factory), 5 services + rate-limit.guard (DI), 6 controllers (Swagger), 4 DTOs (@ApiProperty), `package.json` (deps + scripts), `vercel.json` (runtime + maxDuration)

### Deleted (1): `src/health.controller.ts` → replaced by `src/health/`

### NOT Changed
All 6 feature module files (except services/controllers listed), `src/db/schema.ts`, `src/lib/*` (auth, redis, openrouter, merchant-table, prompts), `drizzle.config.ts`, `tsconfig.json`, `nest-cli.json`, `eslint.config.mjs`

---

## Build Order (Phase Dependency Graph)

```
Phase 3: DatabaseModule + Initial Migration (standalone foundation)
  └── Phase 4: Service DI Migration (needs DatabaseModule)
        ├── Phase 5: Unit Tests (needs injectable DB)
        │     └── Phase 8: CI/CD Pipeline (needs tests to gate)
        ├── Phase 6: Monitoring + Swagger + Health
        │     (parallel: CommonModule, swagger, health — depends on Phase 4)
        └── Phase 7: Security + Performance Fixes (after Phase 4)
              (CORS, rate limiter, prompt injection, pagination, SQL aggregation)
              Phase 9: E2E Testing (needs preview deployment from Phase 8)
```

**Rationale:** DatabaseModule is the foundation — every other phase depends on injectable DB. Service DI migration is low-risk (5 constructor lines). Tests can't exist without DI. CI can't gate without tests. Monitoring, Swagger, Health, and Security parallelize after Phase 4.

---

## What NOT to Change

| Component | Reason to Preserve |
|-----------|-------------------|
| 6 feature module structure | Clean, well-organized. Only constructor changes. |
| Better Auth setup (src/lib/auth.ts) | Working, stable. @thallesp/nestjs-better-auth integration is correct. |
| Cached serverless pattern (main.ts) | Battle-tested Vercel pattern. Don't replace. |
| class-validator DTO validation | Working. Don't add Zod (adds dependency for zero gain). |
| nestjs-pino logger | Properly configured with redaction. |
| Lazy-init Redis/OpenRouter clients | Correct serverless pattern (avoid crash-at-import). |
| Direct schema imports from schema.ts | Normal Drizzle pattern. Services import types from schema. |

---

## Sources

- NestJS docs — `@nestjs/testing` `TestModuleBuilder` patterns (Context7 verified)
- NestJS Swagger — `DocumentBuilder`, SwaggerModule.setup(), `@ApiProperty` (Context7 verified)
- NestJS Terminus — HealthCheckService, custom health indicators (Context7 verified)
- Sentry NestJS SDK README — `SentryModule.forRoot()`, `SentryGlobalFilter`, `@SentryTraced` (Context7 verified)
- Drizzle ORM docs — `better-sqlite3` driver, `:memory:` mode, migrations (Context7 verified)
- Drizzle ORM docs — `drizzle-kit generate`, `migrate()`, `check` commands (Context7 verified)
- PostHog Node SDK docs — server-side initialization, `flushAt`, `shutdown` (Context7 verified)
- NestJS docs — `ConfigModule.forRoot({ validate })` pattern (Context7 verified)
- Codebase audit — `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `STRUCTURE.md`
