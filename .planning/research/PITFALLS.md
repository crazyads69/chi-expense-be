# Domain Pitfalls — NestJS Serverless Hardening

**Domain:** NestJS 11 serverless API hardening for production
**Researched:** 2026-04-26

## Critical Pitfalls

Mistakes that cause rewrites or major production incidents.

### Pitfall 1: Sentry Not Initialized Before NestJS Bootstrap
**What goes wrong:** Calling `Sentry.init()` inside a NestJS module constructor or after `NestFactory.create()`. Sentry SDK must patch the runtime (global error handlers, promise rejection tracking) BEFORE NestJS takes over error handling.

**Why it happens:** Developers naturally place initialization code in NestJS modules. The Sentry NestJS docs emphasize "import this first!" but it's easy to miss.

**Consequences:** Unhandled exceptions, uncaught promise rejections, and Express errors are not reported to Sentry. The `SentryGlobalFilter` catches NestJS-layer exceptions but not Node.js-level crashes (e.g., `unhandledRejection` from the Drizzle client).

**Prevention:**
```typescript
// src/main.ts — CORRECT order
import './instrument';                // ← FIRST: Sentry.init() runs before anything else
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// For Vercel lazy bootstrap:
async function bootstrap() {
  // Sentry already initialized by instrument.ts import
  const app = await NestFactory.create(AppModule);
  return app;
}
```

**Detection:** Check if Sentry receives `unhandledRejection` events in production. If missing, initialization order is wrong.

---

### Pitfall 2: PostHog Events Lost on Vercel Serverless Termination
**What goes wrong:** Using PostHog's default batching configuration (`flushAt: 15` events or `flushInterval: 10000` ms) on Vercel serverless. The function terminates after sending the HTTP response, potentially before the batch flush timer fires.

**Why it happens:** PostHog's Node SDK is designed for long-running servers (Express/Fastify). Vercel functions have a different lifecycle: request → response → termination. The SDK's default assumes the process stays alive.

**Consequences:** Analytics data gaps. Product decisions based on incomplete data. Silent data loss with no error indication.

**Prevention:**
```typescript
const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: 'https://eu.i.posthog.com',
  flushAt: 1,          // send each event immediately
  flushInterval: 0,    // no timer-based flush
});
```

**Detection:** Compare PostHog event counts against server-side log counts. Gaps indicate lost events.

---

### Pitfall 3: Test Database Hitting Production Turso
**What goes wrong:** Writing unit tests that call the production Drizzle client (`src/db/client.ts` singleton) instead of an in-memory SQLite database. Every test run modifies the production database.

**Why it happens:** The current architecture exports `db` as a module-level singleton (`export const db = drizzle(client, { schema })`). Services import this directly. Without a provider token refactor, there's no injection point for a mock.

**Consequences:** Tests create/delete real user data. CI runs pollute production database. Test failures can corrupt real data. Tests are not repeatable.

**Prevention:** Refactor `db` to use a NestJS custom provider token BEFORE writing database-touching tests. The pattern:
1. Create `DRIZZLE_CLIENT` injection token in `src/db/db.provider.ts`
2. Export from a `DatabaseModule` (not as a module-level singleton)
3. In tests, override with `better-sqlite3 :memory:` instance
4. Run schema creation in `beforeAll()`

**Detection:** If any test file imports from `src/db/client.ts` instead of using dependency injection, it's hitting production.

---

### Pitfall 4: Migration Drift — `drizzle-kit push` vs `generate + migrate`
**What goes wrong:** Using `drizzle-kit push` to directly sync schema to production. No migration files are created. Schema changes have no audit trail.

**Why it happens:** `push` is the fastest development workflow. Developers stick with it because it's convenient. Production should use `generate` then `migrate`.

**Consequences:** No way to reproduce the database state in a new environment. Rollback impossible. Multiple developers can conflict on schema changes. No CI validation that migrations match the schema.

**Prevention:**
```bash
# Development (local only):
npx drizzle-kit push

# Production workflow:
npx drizzle-kit generate    # creates SQL files in drizzle/
git add drizzle/            # commit migration files
git push                    # Vercel deploys

# Production migration (run via script or CI):
npx drizzle-kit migrate     # applies pending migrations
```

**Detection:** If `drizzle/` directory is empty or migrations don't exist, `push` is being used. CI should check that `drizzle-kit generate` produces no new files (schema matches migrations).

---

### Pitfall 5: CORS Origin Validation Breaks Mobile App Deep Links
**What goes wrong:** Restricting CORS to `FRONTEND_URL` breaks the Expo mobile app's `chi-expense://` custom scheme and Expo Go's `exp://` scheme. These are not standard HTTPS origins.

**Why it happens:** The CORS middleware (`cors` package used by NestJS) validates the `Origin` header. Mobile apps using custom URL schemes (Expo, React Native) send `chi-expense://` or `exp://` as the origin, which fails strict origin validation.

**Consequences:** Mobile app cannot make API requests. Auth callbacks fail (Better Auth uses cookies with `SameSite: 'none'` and requires exact `Origin` matching).

**Prevention:**
```typescript
// src/main.ts — dynamic origin validation
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'chi-expense://',
  'exp://',
].filter(Boolean) as string[];

app.enableCors({
  origin: (origin, callback) => {
    // Mobile apps may not send Origin header (Expo fetch)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

**Detection:** Test from Expo Go on a physical device. If API calls fail with CORS errors, the custom scheme is not in the allowlist.

---

## Moderate Pitfalls

### Pitfall 6: Environment Validation Rejects Optional Production-Only Vars
**What goes wrong:** Using `skipMissingProperties: false` in `validateSync()` rejects optional env vars (like `SENTRY_DSN`, `POSTHOG_API_KEY`) that should only be required in production.

**Why it happens:** The `class-validator` validation function runs in all environments. Env vars that are production-only will be missing in development/test.

**Consequences:** App fails to start in development because `SENTRY_DSN` is not set locally.

**Prevention:** Mark production-only vars with `@IsOptional()` and gate their usage in code:
```typescript
// In the Sentry init:
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',  // disable in dev
});
```

---

### Pitfall 7: better-sqlite3 Native Addon Build in CI
**What goes wrong:** `better-sqlite3` requires native compilation. In GitHub Actions CI, the `ubuntu-latest` runner may need build tools (`build-essential`, `python3`) or the installation of pre-built binaries may fail.

**Why it happens:** `better-sqlite3` is a native Node.js addon (C++ bindings to SQLite). npm install compiles it from source if no pre-built binary matches the platform.

**Consequences:** CI fails with `node-gyp` errors. Tests cannot run.

**Prevention:**
1. Use `ubuntu-latest` (pre-built binaries available for glibc Linux)
2. If pre-built fails: `sudo apt-get install build-essential python3` in CI step
3. Fallback option: Use `@libsql/client` with a local file (`file:test.db`) for CI — no native compilation needed
4. Add `better-sqlite3` to `optionalDependencies` so CI can proceed without it if fallback is in place

---

### Pitfall 8: Swagger Decorators Break Tree-Shaking
**What goes wrong:** Adding `@ApiProperty()` decorators to every DTO increases the bundle size. NestJS (with Webpack) doesn't tree-shake decorator metadata.

**Why it happens:** Decorators are runtime code. `@ApiProperty()` adds metadata to the class prototype. Vercel bundles the entire decorated module.

**Consequences:** Increased cold start time. For this project's scale (<20 DTOs), the impact is negligible (~5KB). At scale, use `@nestjs/swagger` CLI plugin to strip decorators at build time.

**Prevention:** For this project: no action needed. Impact is ~5KB. For larger projects: enable the `@nestjs/swagger` compiler plugin:
```json
// nest-cli.json
{
  "compilerOptions": {
    "plugins": ["@nestjs/swagger"]
  }
}
```
This auto-generates Swagger metadata from TypeScript types, eliminating the need for `@ApiProperty()` decorators entirely.

---

### Pitfall 9: PostHog identify() Called Without Session on Unauthenticated Routes
**What goes wrong:** Calling `posthog.capture()` with a placeholder `distinctId` before authentication (e.g., on the health endpoint or rate-limited anonymous requests).

**Why it happens:** The PostHog SDK expects a `distinctId` for every event. On unauthenticated routes, there's no user ID yet.

**Consequences:** Anonymous events pollute the user analytics dashboard. Cannot distinguish between "1 user making 100 requests" and "100 users making 1 request."

**Prevention:**
```typescript
// Use session ID when available, fall back to 'anonymous'
const distinctId = session?.user?.id ?? 'anonymous';
posthog.capture({ distinctId, event: 'api_request', ... });
```
Better: don't track anonymous events. Only track from authenticated controllers.

---

### Pitfall 10: Multiple drizzle-kit generate Calls Produce Different SQL
**What goes wrong:** Running `drizzle-kit generate` after schema changes that only reorder columns or change defaults produces SQL migration files that are semantically empty but different.

**Why it happens:** Drizzle Kit generates SQL based on the current schema representation, which can include column ordering and formatting differences that don't affect the database state.

**Consequences:** CI migration checks fail because "new" migrations are detected when the schema hasn't materially changed. Flaky CI.

**Prevention:**
1. Only run `generate` when schema actually changes (new columns, types, constraints)
2. Run `drizzle-kit check` (if available) to verify schema matches migrations
3. In CI, run `drizzle-kit generate --name ci-check` and fail if any new files are created

---

## Minor Pitfalls

### Pitfall 11: Compression Middleware Order
**What goes wrong:** Placing `compression()` before body parsing middleware. Compressed request bodies are not parsed correctly.

**Why it happens:** Express middleware order matters. `compression()` should be after body parsers and auth middleware.

**Consequences:** Request body parsing fails for compressed requests. Mobile app clients may not send compressed requests, so this might go unnoticed in testing but break in production with certain client libraries.

**Prevention:**
```typescript
app.use(helmet());
app.enableCors({ ... });
app.use(compression());  // after security, before routes — NOT before body parsing
// NestJS body parsing happens inside the framework, after middleware
```

**Note:** For NestJS with Better Auth's `bodyParser: false`, compression is fine at the standard location.

---

### Pitfall 12: GitHub Actions Node Cache Not Working for Native Addons
**What goes wrong:** `actions/setup-node@v4` with `cache: 'npm'` caches `node_modules`, including `better-sqlite3` native binaries. The cached binary may be compiled for a different OS version.

**Why it happens:** GitHub Actions runners are updated periodically. A binary compiled on `ubuntu-22.04` may not run on `ubuntu-24.04`.

**Consequences:** CI tests fail with "invalid ELF header" or "GLIBC version mismatch" errors.

**Prevention:** Add `better-sqlite3` to the cache exclude list, or run `npm rebuild better-sqlite3` after `npm ci` in CI:
```yaml
- run: npm ci
- run: npm rebuild better-sqlite3  # ensure native binary matches runner
```

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Testing setup | DB singleton prevents injection (Pitfall 3) | Refactor to `DatabaseModule` + custom provider BEFORE writing tests |
| Database migrations | Using `push` instead of `generate + migrate` (Pitfall 4) | Document migration workflow. Add CI check for drift |
| CORS fix | Mobile app deep links break (Pitfall 5) | Test from Expo Go on physical device before merging |
| Sentry integration | Init order wrong (Pitfall 1) | Verify Sentry receives `unhandledRejection` events |
| PostHog integration | Events lost on serverless (Pitfall 2) | Set `flushAt: 1, flushInterval: 0` |
| Env validation | Production-only vars block dev startup (Pitfall 6) | Mark optional vars with `@IsOptional()` |
| CI/CD pipeline | better-sqlite3 build failure (Pitfall 7) | Rebuild in CI step or use `@libsql/client` fallback |
| API documentation | Swagger decorator bloat (Pitfall 8) | Negligible at this scale. Monitor if DTO count grows >50 |
| Compression | Middleware ordering (Pitfall 11) | Standard Express middleware order — no special handling needed |
| Health checks | @nestjs/terminus breaking on Turso API | Test locally with Turso connection before relying on health check |

## Sources

- Context7 `/getsentry/sentry-javascript` — NestJS setup docs, initialization order requirement, `SentryGlobalFilter` registration (HIGH confidence)
- Context7 `/nestjs/docs.nestjs.com` — Testing module, config validation, Swagger plugin docs (HIGH confidence)
- PostHog Node SDK README (npm) — `flushAt`, `flushInterval`, serverless considerations (MEDIUM confidence — derived from SDK docs, not explicit serverless guide)
- Drizzle ORM docs — `drizzle-kit push` vs `generate + migrate`, `better-sqlite3` driver (HIGH confidence)
- Vercel docs — Function lifecycle, `maxDuration`, `runtime` config (HIGH confidence)
- `cors` npm package docs — Dynamic origin validation, custom scheme support (MEDIUM confidence)
- GitHub Actions `setup-node` docs — Cache behavior, native addon caveats (MEDIUM confidence)
