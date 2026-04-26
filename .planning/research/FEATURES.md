# Feature Landscape

**Domain:** NestJS 11 serverless API — production hardening for expense tracking backend
**Researched:** 2026-04-26
**Overall confidence:** HIGH (verified via Context7 NestJS docs, codebase audit CONCERNS.md, project spec Section 12)

---

## What This File Covers

Production-readiness features for hardening the Chi Expense NestJS backend, categorized as:
- **Table stakes** — Must build; deploying without these exposes users to security/reliability/data-loss risk
- **Differentiators** — Shows engineering maturity; build when fundamentals are solid
- **Anti-features** — Deliberately NOT build for a solo-dev, single-instance serverless project at <1K users

All complexity estimates assume a single developer working within the existing NestJS + Drizzle + Turso + Vercel architecture.

---

## Existing Features (Already Built)

| Feature | Status | Notes |
|---------|--------|-------|
| GitHub OAuth (Better Auth) | Done | Session + Bearer token, Expo plugin, cross-subdomain cookies |
| LLM expense parsing (text + image) | Done | OpenRouter, Qwen3-8B + GPT-4o-mini, merchant lookup table |
| Transaction CRUD with monthly filtering | Done | Drizzle ORM, `@Session()` auth scoping |
| Monthly spending insights | Done | Category breakdown, daily timeline (in-memory aggregation) |
| Category management with lazy init | Done | Default categories, race-condition handling |
| Account deletion (cascade) | Done | Drizzle transaction, all tables purged |
| Account data export (GDPR-style) | Done | JSON export of all user data |
| Rate limiting on LLM endpoints | Done | Upstash Redis sliding window, 20 req/hr per user |
| Structured JSON logging (Pino) | Done | `nestjs-pino`, header redaction in production |
| Vercel serverless deployment | Done | Cached server instance pattern, cold-start reuse |
| DTO validation (class-validator) | Done | Whitelist, transform, forbidNonWhitelisted |
| Helmet security headers | Done | Default configuration |

---

## Table Stakes

Features users and operators expect. Missing any = production deployment is irresponsible.

### 1. Testing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unit tests for all 6 services | Codebase has ZERO `.spec.ts` files. CONCERNS.md #1 issue | **High** (volume: 6 services, 3 utilities) | NestJS `Test.createTestingModule()` well-documented. Jest configured but never used |
| Unit tests for critical utilities | RateLimitGuard, Vietnamese regex parsing, month validation — complex logic with edge cases | **Medium** | `parseAmount` regex for Vietnamese number formats (`35k`, `nghìn`, `1,500`) has untested edge cases |
| In-memory test database | Tests must run in isolation, not against production Turso | **Medium** | `better-sqlite3` with `:memory:` + Drizzle SQLite adapter. Must verify libsql-specific features (RETURNING clause) are compatible |
| E2E tests for core flows | Existing e2e test is a stub: tests `GET /` for `"Hello World!"` — a nonexistent endpoint | **Medium** | 12 test cases: auth → CRUD → insights → delete. Mock OpenRouter for LLM endpoints |

**Minimum viable coverage targets (solo-dev context):**
- Service layer: 70%+ (business logic — where bugs cause data issues)
- Controller layer: Integration-tested via E2E (not isolated unit tests)
- Utility functions (parsing, guards): 80%+ (pure logic, high-value tests)
- E2E: Happy-path coverage of all 8 endpoints + auth flow

**NOT table stakes:** 90%+ coverage targets, snapshot testing, visual regression testing.

### 2. API Documentation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OpenAPI/Swagger specification | Mobile app developers need request/response schemas. CONCERNS.md flags "No API documentation" | **Low** | `@nestjs/swagger` — decorate DTOs with `@ApiProperty`, controllers with `@ApiTags` |
| Swagger UI at `/api/docs` | Interactive API exploration during development | **Low** | `SwaggerModule.setup('api/docs', app, documentFactory)` |
| DTO field documentation | Every field needs description, example, and constraints visible in Swagger | **Low** | Existing DTOs already have `class-validator` — add `@ApiProperty` alongside |

**Implementation shortcut:** NestJS CLI plugin (`@nestjs/swagger/plugin` in `nest-cli.json`) auto-generates `@ApiProperty` from `class-validator` decorators — no manual annotation needed for most fields.

### 3. Error Handling & Resilience

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Global exception filter | Current error format is inconsistent. Some throw NestJS exceptions (good), some silently return defaults (bad) | **Low** | `@Catch()` + `APP_FILTER`. Standardize: `{ statusCode, message, timestamp, path }` |
| LLM failure → proper error | CONCERNS.md High: LLM failures return `amount: 0, merchant: 'Unknown'` — same as valid empty parse. User sees broken data | **Medium** | Throw 502 on OpenRouter failure. Text: fall back to regex only. Image: always propagate error so user can retry |
| OpenRouter timeout + retry | CONCERNS.md High: No timeout on OpenAI client. Vercel Hobby kills at 10s default | **Low** | `timeout: 8000` + `maxRetries: 1` on OpenAI client. Handle `TimeoutError` explicitly with user-facing message |
| Request timeout interceptor | Prevents hung requests from consuming Vercel function execution budget | **Low** | RxJS `timeout()` with per-endpoint thresholds: 25s default, 15s text LLM, 45s image LLM |
| Startup-time env validation | CONCERNS.md Medium: Missing env vars cause cryptic runtime errors (`Cannot read properties of undefined`) | **Low** | `ConfigModule.forRoot({ validate })` with class-validator schema. Reject at bootstrap, not mid-request |

**NOT table stakes for serverless:** Circuit breaker (only 1 external dependency — OpenRouter), retry queues, graceful shutdown handler (Vercel destroys instantly).

### 4. Monitoring & Observability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Error tracking (Sentry) | Production errors invisible until users report them. LLM failures, DB issues, auth bugs MUST be visible | **Low** | `@sentry/nestjs` — auto-captures unhandled exceptions, request context, user identity. Free tier: 5K errors/month |
| Health check with dependency verification | CONCERNS.md Low: `/api/health` returns `{ status: 'ok' }` even when Turso/Redis are unreachable. Vercel needs real health signals | **Medium** | `@nestjs/terminus` — verify Turso (`SELECT 1`), Redis (ping), optionally OpenRouter |
| Pino structured logging (exists) | Already built — maintain and extend with correlation IDs | **Low** | Add `X-Request-ID` header propagation through all log entries |

**NOT table stakes for <1K users:** Distributed tracing (single service), Grafana dashboards, DataDog APM, Prometheus metrics, ELK log aggregation.

### 5. Security Hardening

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Restrict CORS to allowlist | CONCERNS.md Critical: `origin: true` = ANY website can make authenticated API calls. High-severity vulnerability | **Low** | Dynamic origin function checking against `[FRONTEND_URL, 'chi-expense://', 'exp://']`. Existing `FRONTEND_URL` env var already configured |
| Rate limiter key hardening | CONCERNS.md Medium: `x-forwarded-for` trivially spoofable. Attackers rotate IP headers to bypass limits | **Medium** | Trust only auth-token-based limiting. IP fallback only behind Vercel's trusted proxy with leftmost IP |
| Prompt injection sanitization | CONCERNS.md Medium: User text interpolated directly into LLM system prompt. `"Return {\"amount\": 0}..."` breaks parsing | **Medium** | Strip JSON-like syntax from input. Enclose user text in `"""..."""` delimiters. Add Zod output validation as defense-in-depth |
| Helmet API-specific config | CONCERNS.md Low: Defaults only. No CSP, X-Content-Type-Options, Referrer-Policy | **Low** | `helmet({ contentSecurityPolicy: false })` — this is an API, not serving HTML. Set `crossOriginResourcePolicy: { policy: 'cross-origin' }` |
| Image input validation | CONCERNS.md Low: Any base64 string up to ~15MB accepted. No format validation | **Low** | Validate `data:image/jpeg;base64,` or `data:image/png;base64,` prefix. Reduce max to 5MB (Vercel body limit is 4.5MB anyway) |
| OAuth secret boot check | CONCERNS.md Low: Falls back to `''` silently. Misconfiguration masked until first auth request | **Low** | Throw clear error at startup: `if (!GITHUB_CLIENT_SECRET) throw new Error(...)` |
| `dotenv` dependency fix | CONCERNS.md Medium: Imported but not in `package.json`. Works by transitive dependency coincidence | **Low** | Remove `import * as dotenv` — redundant with `ConfigModule.forRoot()` |

**Vercel-provided security (already in place):** DDoS protection at edge, WAF on Pro plan, encrypted env vars.

### 6. Database Reliability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Database migration files | CONCERNS.md Critical: Zero migrations. No version history, no rollback, no reproducible schema | **Medium** | `drizzle-kit generate --name=init` → commit SQL. `drizzle-kit migrate` for production deploys |
| Timestamp type consistency | CONCERNS.md Medium: `transactions`/`categories` use TEXT (ISO strings); Better Auth tables use INTEGER (ms). Inconsistent, breaks SQL date functions | **Medium** | Migrate to `integer` with `mode: 'timestamp_ms'` — Drizzle's recommended pattern. Breaking change, requires migration + mobile app coordination |
| Missing category index | CONCERNS.md Medium: No index on `transactions.category` → full-table scan on insights category grouping | **Low** | `index('idx_transactions_category').on(table.category)`. Optional: compound `(userId, category)` |
| Fragile UNIQUE constraint handling | CONCERNS.md Medium: `error.message.includes('UNIQUE constraint failed')` — string-matching on SQLite error messages (brittle) | **Low** | Drizzle `onConflictDoNothing()` — declarative, database-agnostic, no string matching |
| HTTP-based Turso client | CONCERNS.md Medium: TCP connections per serverless invocation. Turso free: 500 concurrent. HTTP is stateless, better for Vercel | **Medium** | `@libsql/client/http` — stateless HTTP protocol. Recommended by Drizzle for edge/serverless |
| Database health check | Verify connectivity before serving traffic. CONCERNS.md notes `/api/health` doesn't check DB | **Low** | `db.select().from(user).limit(1)` — quick connectivity test in Terminus health indicator |

### 7. CI/CD & Deployment Safety

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Node.js version pinning | CONCERNS.md High: No `runtime` in vercel.json → Vercel defaults to `nodejs18.x` but project requires `>=20.x` | **Low** | `"runtime": "nodejs20.x"` in vercel.json build config |
| `maxDuration` for LLM endpoints | CONCERNS.md Medium: Image parsing takes 8-15s, Hobby kills at 10s. Pro defaults to 30s but configurable | **Low** | `"maxDuration": 30` in vercel.json (requires Pro plan for >10) |
| Build-time env validation | CONCERNS.md Medium: Missing env vars surface as cryptic runtime errors | **Low** | `ConfigModule.forRoot({ validate })` — fail fast at deploy time |
| CI pipeline (test + lint) | Block deploys if tests fail or lint errors exist. Prevents broken code from reaching production | **Medium** | Vercel GitHub integration runs `vercel-build`. Add `test` and `lint` as pre-build steps in CI |
| Migration CI check | Validate migrations are up-to-date before deploy. Prevents schema drift between code and database | **Low** | `drizzle-kit check` in CI — fails if schema isn't represented in migrations |

**Vercel-native safety (already provided):** Automatic HTTPS, instant rollback, preview deployments per PR, build caching.

**NOT table stakes:** Blue/green deploys, canary releases, IaC (Terraform), Docker containers.

### 8. Performance Optimization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Transaction list pagination | CONCERNS.md High: No LIMIT/OFFSET → 1000s of transactions returned, Vercel memory exhaustion risk | **Medium** | Cursor-based or offset pagination, default 50/page. Return `{ data, total, hasMore, page, limit }` |
| SQL aggregation for insights | CONCERNS.md Medium: JavaScript `reduce()` over ALL rows. Push computation to database | **Medium** | `GROUP BY category` + `SUM(ABS(amount))` + `COUNT(*)`. Also sum daily timeline via SQL |
| Date range queries (NOT LIKE) | CONCERNS.md Low: `LIKE '2026-04%'` on TEXT column — prevents B-tree index optimization | **Low** | `gte(createdAt, '2026-04-01')` + `lt(createdAt, '2026-05-01')` — proper range query |
| Redundant query elimination | CONCERNS.md Low: Recursive `list()` call on category init race condition | **Low** | Replace with single `SELECT` after `onConflictDoNothing()` |
| `maxDuration` for image parsing | CONCERNS.md Medium: LLM image endpoint can exceed Vercel default timeout | **Low** | Covered in CI/CD section above — same fix |

**Deferred to post-launch:** Redis caching (categories, insights) — merchant lookup is already in-memory, and categories list is small.

---

## Differentiators

Features showing engineering maturity. Build after fundamentals (Table Stakes) are solid.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Redis caching (categories, insights) | Reduces database load, faster responses. Upstash Redis already provisioned for rate limiting — add caching at zero ops cost | **Medium** | `@nestjs/cache-manager` + Redis store. Cache categories per user (5 min TTL), insights (1 min TTL) |
| Sign in with Apple | App Store requirement for apps with third-party social login. Spec Section 12 calls this "#1 rejection risk" | **Medium** | Better Auth native Apple provider. Requires Apple Developer account ($99/yr) |
| Sentry performance tracing | Identifies slow endpoints before users complain. Actionable data on which SQL queries or LLM calls are slow | **Low** | `tracesSampleRate: 0.1` — near-zero cost at free tier |
| API versioning | Breaking changes (pagination response shape, timestamp format) without breaking mobile app | **Low** | URI versioning: `/api/v1/...`. NestJS `@nestjs/swagger` supports multi-version docs |
| Query param DTOs | Current code manually regex-validates `month` in services. DTO ensures consistent error messages | **Low** | `MonthQueryDto` with `@IsOptional() @Matches(/^\d{4}-\d{2}$/)` |
| Database client as injectable provider | Decouples services from global `db` singleton. Enables in-memory test databases. CONCERNS.md marks this as maintainability improvement | **Medium** | `DatabaseModule` with custom provider token. Prerequisite for unit tests |
| LLM response validation (Zod) | Catches malformed OpenRouter JSON before it propagates. CONCERNS.md notes `as` type casts without runtime checks | **Low** | Zod schema on parsed JSON. Reject responses not matching expected shape |
| LLM model config via env vars | A/B test models without code deploys. Qwen3-8B vs. others, GPT-4o-mini vs. alternatives | **Low** | `OPENROUTER_MODEL`, `OPENROUTER_IMAGE_MODEL`, `LLM_TEMPERATURE` env vars |
| Correlation ID propagation | `X-Request-ID` header propagated through all Pino log entries → unified request tracing across cold starts | **Low** | NestJS middleware. With serverless, correlation IDs span the full request lifecycle |
| Shared utility extraction | Remove duplicate month parsing, date-utils, and pagination logic. CONCERNS.md flags copy-pasted regex | **Low** | `src/lib/date-utils.ts`, `src/lib/pagination.ts` |
| Git hooks (pre-commit) | Run lint + tests on changed files before commit. Prevents broken code from reaching CI | **Low** | `husky` + `lint-staged` |
| Staging/preview environment | Preview deployments currently share production DB. Separate Turso DB + Redis for preview | **Medium** | Switch via `VERCEL_ENV` env var. Turso allows multiple free-tier databases |

---

## Anti-Features

Features to explicitly NOT build at this scale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Microservice decomposition** | Single developer, single Vercel function, <1000 users. Splitting adds deployment complexity, network latency, debug difficulty | Keep the NestJS modular monolith. Module boundaries already well-defined |
| **Message queue / job system** (BullMQ, RabbitMQ, SQS) | Only long-running operation (LLM image) is user-synchronous. Queuing adds complexity without UX improvement | Set appropriate timeouts. If latency >5s, implement client-side polling |
| **GraphQL API** | REST sufficient for mobile app with 8 fixed endpoints. GraphQL adds complexity (schema federation, N+1, resolver auth) | Continue with REST. Add query params if mobile app needs flexibility |
| **WebSocket / real-time** | Vercel serverless does NOT support WebSockets. For push notifications, use Expo push | Use `expo-notifications` + Vercel Cron for scheduled pushes (v1.2) |
| **Self-hosted database** (VPS Postgres) | Operational burden (backups, patches, monitoring) drains solo-dev time | Stick with Turso. Migrate to paid tier only when exceeding free tier |
| **Custom auth system** | Better Auth already integrated and handles OAuth, sessions, App Store compliance | Continue with Better Auth. Monitor `@thallesp/nestjs-better-auth` for breaking changes |
| **Feature flags platform** (LaunchDarkly, GrowthBook) | Overkill for solo dev. LLM model choice = env var | Env vars for simple toggles. Vercel Edge Config for runtime (if needed later) |
| **Multi-region deployment** | Vietnam-targeted app, single Vercel region sufficient. Turso already replicates DB | Deploy to Vercel Singapore region when available |
| **IaC (Terraform, Pulumi)** | Vercel + Turso + Upstash configured via dashboard/env. No cloud resources benefit from IaC at this scale | Document env vars in `.env.example` |
| **Admin dashboard** | Wasted effort for 1 developer. Existing service dashboards sufficient | Vercel Analytics + Sentry + Turso dashboard |
| **E2E test coverage >50%** | E2E tests slow, flaky (external APIs), expensive to maintain. Unit tests provide better ROI | 12 happy-path E2E tests. Focus energy on unit tests for business logic |

---

## Feature Dependencies

```
Testing (unit tests) ← requires → Database client as injectable provider (DatabaseModule)
    ↑                              ↑
    ├── Test DB config             └── DRIZZLE injection token

Database migrations ← must precede → Timestamp type consistency fix
    ↑                                      ↑
    ├── Schema versioning                  └── Needs migration to change column type

Pagination ← depends on → Date range queries (gte/lt instead of LIKE)
                Both touch transactions.service.ts

Security hardening (CORS, rate limiter, prompt injection) → Independent — parallelizable

Error handling (global filter, LLM errors, timeouts) → Independent — parallelizable

OpenAPI/Swagger docs → Anytime — purely additive decorators, no conflicts

Monitoring (Sentry, Terminus) → Independent — additive middleware/imports

CI/CD (vercel.json fixes, env validation) → Independent — config only

Redis caching → Post-pagination, post-SQL-aggregation (bottlenecks identified after optimization)
```

---

## MVP Recommendation (Implementation Order)

### Wave 1: Fix Data Loss & Security Vectors
1. **Database migrations** — no recovery from schema mistakes without them (CONCERNS.md #2)
2. **CORS restriction** — `origin: true` is an open door (CONCERNS.md #3)
3. **LLM error surface** — stop silently returning `amount: 0` on failure
4. **Rate limit key hardening** — stop trusting spoofable `x-forwarded-for`

### Wave 2: Make The System Observable & Testable
5. **Sentry error tracking** — you cannot fix what you cannot see
6. **Health check with dependency verification** — Vercel needs real health signals
7. **Test infrastructure** (DatabaseModule, in-memory DB) — prerequisite for writing tests

### Wave 3: Establish Automated Quality Gates
8. **Unit tests for all 6 services + 3 utilities**
9. **E2E tests for core flows** (12 test cases)
10. **CI pipeline** (test + lint + migration check before deploy)

### Wave 4: Fix Performance & Reliability
11. **Transaction list pagination** — prevent response bloat
12. **SQL aggregation for insights** — prevent O(n) memory processing
13. **OpenRouter timeout + retry** — prevent hung requests
14. **Date range queries** — proper index utilization

### Wave 5: Polish for Multi-User Launch
15. **OpenAPI/Swagger docs** — mobile dev documentation
16. **Startup-time env validation** — fail-fast on misconfiguration
17. **Vercel config fixes** (Node.js version, maxDuration)
18. **Timestamp consistency migration**

### Defer to Post-Launch (v1.1+)
- Redis caching (useful at >100 active users, merchant lookup covers 60% already)
- Apple Sign-In (App Store requirement; submit with demo account first)
- Correlation ID propagation
- Git hooks
- Staging/preview environment

---

## Status: What's Built vs What's Missing

| Area | Has | Missing (Table Stakes) | Missing (Differentiators) |
|------|-----|------------------------|--------------------------|
| **Testing** | Jest configured | All unit tests, real e2e tests, test DB config | Test factories/fixtures |
| **API Docs** | Nothing | OpenAPI spec, Swagger UI, DTO docs | Multi-version docs |
| **Error Handling** | `NotFoundException`, `BadRequestException`, try/catch for LLM | Global filter, LLM error propagation, timeouts, env validation | Correlation IDs |
| **Monitoring** | Pino structured logging | Sentry error tracking, real health checks | Performance tracing |
| **Security** | Helmet defaults, rate limiting (LLM only), DTO validation | CORS restriction, rate limit key hardening, prompt injection fix, image validation, OAuth boot check | Apple Sign-In |
| **Database** | Drizzle ORM, schema.ts | Migration files, timestamp consistency, category index, HTTP client, ON CONFLICT DO NOTHING | Read replicas |
| **CI/CD** | `vercel-build` script, GitHub integration | Node.js version pin, maxDuration, env validation, CI test/lint | Staging environment, migration CI check |
| **Performance** | In-memory merchant lookup | Pagination, SQL aggregation, date range queries | Redis caching |
| **Maintainability** | Module structure, DTOs, DI | Injectable DB client, shared utilities, query param DTOs | LLM model env vars, API versioning |

---

## Sources

| Source | Confidence | URL / Location |
|--------|------------|----------------|
| NestJS OpenAPI docs (Context7) | HIGH | `@nestjs/swagger` official documentation |
| NestJS Terminus health checks (Context7) | HIGH | `@nestjs/terminus` official documentation |
| NestJS Testing (Context7) | HIGH | `Test.createTestingModule()` official documentation |
| NestJS Exception Filters (Context7) | HIGH | Global exception filter pattern |
| NestJS Caching (Context7) | HIGH | `@nestjs/cache-manager` official docs |
| NestJS Security patterns (Context7) | HIGH | Rate limiting, CORS, helmet, env validation |
| Drizzle ORM migrations (Context7) | HIGH | `drizzle-kit generate` + `drizzle-kit migrate` |
| Drizzle serverless/edge (Context7) | HIGH | HTTP-based clients for edge/serverless |
| CONCERNS.md (codebase audit) | HIGH | 50 identified issues across 8 categories |
| ARCHITECTURE.md (existing codebase) | HIGH | Request lifecycle, module design, data flow |
| PROJECT.md (project context) | HIGH | Requirements, constraints, decisions, current state |
| chi-expense-spec-v3.md Section 12 | HIGH | App Store requirements, production gaps, senior dev review |
| NestJS best practices skill | HIGH | 40 rules across 10 categories |
| current `package.json` | HIGH | Exact dependency versions in use |
