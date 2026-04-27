# Chi Expense

## What This Is

Chi Expense is a zero-friction expense tracking mobile app where users log spending in under 2 seconds via Vietnamese freetext, camera receipt OCR, or banking SMS paste. An LLM automatically extracts amount, merchant, and category. Multi-user commercial product targeting Vietnamese market, distributed on App Store + Google Play. This is the **NestJS backend** deployed on Vercel serverless functions.

## Core Value

Log an expense in 2 seconds with zero UI friction — type Vietnamese, take a photo, or paste SMS and the LLM handles the rest.

## Requirements

### Validated

- ✓ User can authenticate via GitHub OAuth (Better Auth + NestJS integration) — existing
- ✓ User can submit Vietnamese text for LLM expense parsing (`POST /api/input/text`) — existing
- ✓ User can submit receipt image for LLM OCR parsing (`POST /api/input/image`) — existing
- ✓ User can list monthly transactions (`GET /api/transactions`) — existing
- ✓ User can CRUD transactions (`POST, PATCH, DELETE /api/transactions`) — existing
- ✓ User can view monthly spending insights (`GET /api/insights`) — existing
- ✓ User can list/lazy-init categories (`GET /api/categories`) — existing
- ✓ User can export account data (`GET /api/account/export`) — existing
- ✓ User can delete account with cascade data purge (`DELETE /api/account`) — existing
- ✓ Rate limiting on LLM endpoints (Upstash Redis, 20 req/hr) — existing
- ✓ Structured logging with Pino (`nestjs-pino`) — existing
- ✓ Vercel serverless deployment (cached server instance pattern) — existing

### Validated (v1.0)

- ✓ Fix critical security issues (CORS, rate limiter spoofing, prompt injection) — Phase 2
- ✓ Fix critical reliability gaps (LLM error handling, DB client resilience, timeouts) — Phase 3
- ✓ Fix performance bottlenecks (pagination, SQL aggregation, caching) — Phase 5
- ✓ Establish testing (unit tests for all services, fix e2e test) — Phase 4
- ✓ Establish database migration history (generate initial migrations) — Phase 1
- ✓ Standardize schema types (timestamp consistency, missing indices) — Phase 1
- ✓ Fix deployment config (Node.js version, maxDuration, env validation) — Phase 5
- ✓ Add API documentation (OpenAPI/Swagger) — Phase 6
- ✓ Add observability — Sentry error tracking — Phase 6

### Active

- [ ] Add Apple OAuth for App Store compliance
- [ ] Add Redis caching for categories with hit/miss metrics
- [ ] Add Sentry performance tracing for LLM spans
- [ ] Add x-request-id correlation headers
- [ ] Add API versioning strategy (/api/v1/)
- [ ] Add graceful shutdown handler (SIGTERM/SIGINT)
- [ ] Add request timeout interceptor
- [ ] Add server-side image resize before LLM
- [ ] Extract shared utilities (DRY principle)
- [ ] Add staging/preview environment config

### Out of Scope

- Offline transaction queue — post-launch v1.1
- Push notifications (budget alerts, daily summary) — v1.2
- RevenueCat subscriptions (Chi Pro tier) — v2.0
- Multi-currency support — v3.0
- Widgets (iOS/Android) — v3.0
- Batch expense detection (multiple items per message) — future

## Context

**Current state:** NestJS 11 backend is production-ready with v1.0 complete. All core features implemented (auth, CRUD, LLM parsing, insights, rate limiting), comprehensive test coverage (51 unit + 12 E2E tests), security hardened, performance optimized, and observable (Sentry, health checks, Swagger docs). Deployable to Vercel with Turso (libSQL) database and Upstash Redis.

**v1.0 audit (2026-04-27):** All 25 requirements complete. Minor tech debt identified: Redis health check timeout, Swagger response DTOs, health controller Redis mock pattern.

**Scalability gaps for v1.1:** No caching layer, no request tracing, no API versioning, no graceful shutdown, no image optimization, missing Apple OAuth for App Store compliance.

## Constraints

- **Tech stack:** NestJS 11, TypeScript 5.7, Drizzle ORM + Turso (libSQL), Better Auth 1.6, OpenRouter (LLM), Upstash Redis, Vercel serverless
- **Runtime:** Node.js >= 20.x, Vercel Pro required for commercial use
- **Database:** Turso free tier (9GB, 500M rows/month) — sufficient for < 1000 users
- **LLM costs:** ~$12/month at 100 users (OpenRouter pay-per-use)
- **App Store:** Requires Sign in with Apple, Privacy Policy, AI disclosure, account deletion
- **Mobile app:** Separate repo (chi-expense-app), React Native + Expo SDK 55

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS over Elysia | Vercel official support, enterprise patterns, ecosystem maturity | ✓ Good |
| Better Auth over custom auth | Built-in OAuth, session management, App Store compliant deletion | ✓ Good |
| Turso (libSQL) over PostgreSQL | Edge-distributed, free tier generous, simpler than serverless Postgres | ✓ Good |
| OpenRouter over direct OpenAI | Model flexibility (Qwen3-8B for text, GPT-4o-mini for OCR), cost optimization | ✓ Good |
| Vercel Pro over Hobby | Required for commercial use, larger timeouts, Fluid Compute | ✓ Good |
| `@thallesp/nestjs-better-auth` over manual middleware | NestJS DI integration, session decorator, community-maintained | ⚠️ Revisit (community lib, may break) |

## Current Milestone: v1.1 — Production Maturity & Scalability

**Goal:** Apply big-tech engineering practices to make the backend scalable, observable, and App Store compliant.

**Target features:**
- Apple Sign-In OAuth for App Store compliance
- Redis caching for categories (60s TTL) with hit/miss metrics
- Sentry performance tracing for LLM parsing spans
- x-request-id correlation headers across all requests
- API versioning strategy (/api/v1/) for future breaking changes
- Graceful shutdown handler for zero-downtime deploys
- Request timeout interceptor (408 instead of 504)
- Server-side image resize before LLM API call (15MB → 200KB)
- Extract shared utilities (DRY — duplicate date parsing, month logic)
- Staging/preview environment with separate Turso DB and Redis

## Previous Milestone: v1.0 — Code Hardening & Production Readiness

**Completed:** 2026-04-27
**Requirement Coverage:** 25/25 (100%)

**Delivered:**
- Database foundation with Drizzle migrations and schema fixes
- Security hardening (CORS, rate limiting, input sanitization, OAuth validation)
- Test infrastructure with dependency injection and in-memory SQLite
- Automated quality gates (unit tests, E2E tests, CI pipeline)
- Performance optimization (pagination, SQL aggregation, Vercel config)
- Observability (Sentry error tracking, health checks, Swagger documentation)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-27 after v1.0 completion and v1.1 initialization*
