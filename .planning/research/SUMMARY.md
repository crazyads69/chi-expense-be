# Research Summary: Chi Expense Production Hardening

**Domain:** NestJS 11 serverless API — production-readiness hardening
**Researched:** 2026-04-26
**Overall confidence:** HIGH (verified via Context7 docs, codebase audit, project specification)

## Executive Summary

The Chi Expense backend is a functionally complete NestJS 11 modular monolith deployed on Vercel serverless functions with Turso (libSQL/SQLite), Better Auth, OpenRouter LLM, and Upstash Redis. A codebase audit (CONCERNS.md, 2026-04-26) identified **50 issues** across 8 categories: 2 critical, 8 high, 22 medium, 18 low. The backend works for single-user testing but has gaps before a multi-user commercial launch: zero automated tests, no database migrations, permissive CORS, silent LLM error swallowing, no pagination, and no observability beyond structured logs.

The production hardening effort requires **28 table-stakes features** organized into 5 implementation waves, plus **12 differentiators** that show engineering maturity. The most urgent fixes (data-loss and security vectors) must ship first, followed by test infrastructure, automated quality gates, performance optimization, and finally multi-user polish.

**Key architectural constraint:** Vercel serverless imposes specific patterns — stateless HTTP-based database connections, cached server instances for cold-start reuse, no WebSocket support, and a 300s max function duration on Pro plan. The existing architecture correctly handles these constraints but needs hardening at the edges (timeouts, error propagation, health checks, CI/CD).

## Key Findings

**Stack:** NestJS 11 + Drizzle ORM + Turso (libsql) + Better Auth + OpenRouter + Upstash Redis — well-chosen and stable. No major technology changes needed. The most impactful additions are `@nestjs/swagger` (API docs), `@nestjs/terminus` (health checks), `@sentry/nestjs` (error tracking), and `@nestjs/cache-manager` (Redis caching in later phase).

**Architecture:** The NestJS modular monolith pattern is correct for this scale. Key hardening: make the database client injectable (DI-based for testability), add a global exception filter for consistent error responses, add Sentry initialization at bootstrap, and configure `vercel.json` for production (Node.js version pinning, maxDuration, environment validation).

**Critical pitfall:** The 2 critical issues from CONCERNS.md — zero automated tests and no database migrations — are existential threats. Deploying schema changes without migration history means you cannot roll back. Deploying code changes without tests means you cannot verify correctness. These must be resolved in the first implementation wave.

## Implications for Roadmap

Based on research, the suggested phase structure follows dependency chains and risk prioritization:

### Milestone: v1.0 — Code Hardening & Production Readiness

**Phase 1: Database Foundation** — Generate initial migrations, fix timestamp consistency, add missing index, fix UNIQUE constraint handling, use HTTP-based Turso client.
- *Addresses:* Table stakes — Database reliability (all 6 items)
- *Avoids:* The #2 critical issue (no migration history)
- *Dependencies:* None — foundation layer, can ship first

**Phase 2: Security Hardening** — CORS restriction, rate limit key hardening, prompt injection sanitization, helmet API config, image validation, OAuth secret validation, dotenv cleanup.
- *Addresses:* Table stakes — Security hardening (all 7 items)
- *Avoids:* The #3 critical issue (CORS allows all origins) + 2 high issues
- *Dependencies:* None — independent from other categories

**Phase 3: Test Infrastructure + Error Resilience** — DatabaseModule with DI token, in-memory SQLite test setup, global exception filter, LLM error propagation, OpenRouter timeout + retry, request timeout interceptor, startup-time env validation.
- *Addresses:* Table stakes — Testing (test DB), Error handling (5 of 7 items)
- *Avoids:* The #1 critical issue (zero tests) prerequisite
- *Dependencies:* Phase 1 (test DB needs migrations to exist)

**Phase 4: Automated Quality Gates** — Unit tests for 6 services + 3 utilities, E2E tests (12 happy-path cases), CI pipeline (test + lint + migration check).
- *Addresses:* Table stakes — Testing (all items), CI/CD (CI pipeline)
- *Avoids:* Regression risk from all future changes
- *Dependencies:* Phase 3 (tests can't run without test infrastructure)

**Phase 5: Performance Optimization** — Transaction pagination, SQL aggregation for insights, date range queries, redundant query elimination, maxDuration config.
- *Addresses:* Table stakes — Performance (all 5 items), CI/CD (maxDuration)
- *Avoids:* Vercel timeout kills on image parsing, memory exhaustion from unpaginated queries
- *Dependencies:* Phase 1 (date range queries depend on timestamp consistency)

**Phase 6: Observability + Documentation** — Sentry error tracking, Terminus health checks, OpenAPI/Swagger docs, Node.js version pin, build-time env validation, CI pipeline additions.
- *Addresses:* Table stakes — Monitoring (2 of 3 items), API docs (all 3 items), CI/CD (remaining)
- *Avoids:* Flying blind in production, no API contract for mobile devs
- *Dependencies:* Phase 2 (CORS/Security must be correct before public docs)

**Phase 7: Post-Launch Differentiators** — Redis caching, Apple Sign-In, Sentry performance tracing, correlation IDs, shared utility extraction, API versioning, graceful shutdown.
- *Addresses:* Differentiators (all 12 items)
- *Dependencies:* Phase 5 (caching targets bottlenecks identified after optimization)

### Phase Ordering Rationale

1. **Database first** — Migrations are the foundation. Every schema change (timestamp fix, indices) must be migration-based. Nothing else can touch the schema before migrations exist.
2. **Security second** — CORS `origin: true` is a critical vulnerability. Fix before any code changes that might accidentally rely on it.
3. **Test infrastructure third** — The `DatabaseModule` with DI token is a prerequisite for all unit tests. Establishing the test pattern early prevents rework.
4. **Tests fourth** — Write tests after establishing patterns (migrations exist, DB client is injectable, error handling is consistent). Testing before fixing error handling means tests would assert on the wrong behavior.
5. **Performance fifth** — Optimization after tests provide a safety net. Pagination and SQL aggregation are breaking changes to API response shapes — tests verify backward compatibility.
6. **Observability sixth** — Sentry and health checks after the system is stable. Sending Sentry alerts for pre-existing issues (silent LLM failures, missing env vars) creates noise.
7. **Differentiators last** — Post-launch polish. Not blocking a usable production deployment.

### Research Flags for Phases

| Phase | Research Need | Reason |
|-------|--------------|--------|
| Phase 1 (Database) | LOW | Drizzle migration patterns are well-documented. Turso HTTP client is straightforward |
| Phase 2 (Security) | MEDIUM | Prompt injection sanitization strategy may need experimentation (delimiter approach vs. output validation) |
| Phase 3 (Test Infra) | HIGH | **Needs spike:** In-memory SQLite with libsql schema compatibility. Drizzle `better-sqlite3` vs libsql differences |
| Phase 4 (Tests) | MEDIUM | LLM service mocking patterns (OpenAI SDK, OpenRouter), rate limiter testing with in-memory Redis |
| Phase 5 (Performance) | LOW | Pagination and SQL aggregation are standard patterns. Drizzle supports both natively |
| Phase 6 (Observability) | LOW | Sentry + NestJS integration is well-documented. Swagger is straightforward |
| Phase 7 (Differentiators) | MEDIUM | Apple Sign-In requires Apple Developer account setup. Redis caching strategy depends on workload |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended packages verified via Context7 and `package.json`. No new framework decisions needed |
| Features | HIGH | Grounded in 50-item codebase audit (CONCERNS.md) and project specification (Section 12). Every feature maps to a concrete issue or requirement |
| Architecture | HIGH | Architecture patterns verified against NestJS best practices skill (40 rules). Modular monolith is correct for this scale |
| Pitfalls | HIGH | Pitfalls derived from codebase audit findings, NestJS anti-patterns documentation, and Vercel serverless constraints |

## Gaps to Address

- **In-memory SQLite for Drizzle + libsql testing:** The project uses `@libsql/client`. Drizzle's in-memory testing patterns typically use `better-sqlite3`. Need to verify libsql-specific features (e.g., HTTP sync protocol) work with in-memory SQLite. A phase-3 spike is recommended.
- **OpenRouter API stability:** The LLM error handling changes (Phase 3) need the actual OpenRouter error response shapes. Docs may have changed since codebase was built.
- **Apple Sign-In setup complexity:** Better Auth supports Apple natively, but the developer account, private key, and App Store Connect configuration path needs real-world verification.
- **Vercel Pro plan upgrade timing:** The `maxDuration: 30` configuration requires Pro. The feature is documented but the upgrade must happen before the Performance phase deploys.
