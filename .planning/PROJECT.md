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

### Active

- [ ] Fix critical security issues (CORS, rate limiter spoofing, prompt injection)
- [ ] Fix critical reliability gaps (LLM error handling, DB client resilience, timeouts)
- [ ] Fix performance bottlenecks (pagination, SQL aggregation, caching)
- [ ] Establish testing (unit tests for all services, fix e2e test)
- [ ] Establish database migration history (generate initial migrations)
- [ ] Standardize schema types (timestamp consistency, missing indices)
- [ ] Fix deployment config (Node.js version, maxDuration, env validation)
- [ ] Add API documentation (OpenAPI/Swagger)
- [ ] Add Apple OAuth for App Store compliance
- [ ] Add observability (Sentry/PostHog)

### Out of Scope

- Offline transaction queue — post-launch v1.1
- Push notifications (budget alerts, daily summary) — v1.2
- RevenueCat subscriptions (Chi Pro tier) — v2.0
- Multi-currency support — v3.0
- Widgets (iOS/Android) — v3.0
- Batch expense detection (multiple items per message) — future

## Context

**Current state:** NestJS 11 backend is functional with all core features implemented (auth, CRUD, LLM parsing, insights, rate limiting). Deployable to Vercel with Turso (libSQL) database and Upstash Redis.

**Codebase audit completed (2026-04-26):** 50 issues identified across 8 categories — 2 critical, 8 high, 22 medium, 18 low. Key gaps: zero automated tests, no database migrations, permissive CORS, LLM error handling is silent, no pagination on transaction listing, in-memory insights computation.

**Production readiness:** The codebase works for single-user testing but has gaps before multi-user commercial launch: testing, migration versioning, security hardening, performance optimization, and observability.

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

## Current Milestone: v1.0 — Code Hardening & Production Readiness

**Goal:** Fix all critical/high issues from codebase audit, establish testing and migration infrastructure, harden security, and prepare for multi-user commercial launch.

**Target features:**
- Fix 2 critical + 8 high-severity issues from CONCERNS.md
- Unit test coverage for all services
- Database migrations with version history
- Security hardening (CORS, rate limiter, prompt injection)
- Performance optimization (pagination, SQL aggregation, caching)
- Deployment hardening (Node.js version, maxDuration, env validation)
- API documentation (OpenAPI/Swagger)

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
*Last updated: 2026-04-26 after initialization*
