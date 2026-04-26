# Technology Stack

**Project:** Chi Expense Backend — Production Hardening
**Researched:** 2026-04-26
**Overall confidence:** HIGH

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| NestJS | 11.x | Backend framework | Already in use. Official Vercel support, DI, guards, interceptors, pipes |
| TypeScript | 5.7 | Language | Already in use. Required by NestJS toolchain |
| Express | 5.x (via `@nestjs/platform-express`) | HTTP server | Already in use. Required by Better Auth + Vercel serverless handler |
| Node.js | 20.x | Runtime | Already pinned in `package.json:10`. Vercel Pro supports 20.x and 22.x |

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Turso (libsql) | Current (managed) | Primary database | Already in use. 9GB free tier, edge-distributed, HTTP-based for serverless |
| `@libsql/client/http` | ^0.17 | Serverless-optimized DB driver | Stateless HTTP protocol. Better than TCP WebSocket for Vercel's function model |
| Drizzle ORM | ^0.45 | Type-safe SQL ORM | Already in use. Code-first schema, migration generation, zero runtime overhead |
| `drizzle-kit` | ^0.31 | Migration CLI | Already configured. Generates SQL migrations, validates schema consistency |

### Authentication
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Better Auth | ^1.6 | Auth framework | Already in use. OAuth (GitHub, Apple), session management, account deletion (App Store req) |
| `@thallesp/nestjs-better-auth` | ^2.4 | NestJS integration | Already in use. Session decorator, module for DI, ESM/CJS bridge |
| `@better-auth/expo` | ^1.6 | Expo client plugin | Already in use. SecureStore integration, deep link handling |

### LLM
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI SDK | ^6.34 | OpenRouter API client | Already in use. Compatible with OpenRouter's API. Configure timeout + maxRetries |
| OpenRouter | — (API) | LLM provider | Already in use. Multi-model: Qwen3-8B (text) + GPT-4o-mini (image) |

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | Pro ($20/mo) | Hosting | Already deployed. Commercial use requires Pro. Fluid Compute, 300s max duration |
| Upstash Redis | Current | Rate limiting + caching | Already in use for rate limiting. Same instance can serve caching at zero additional cost |
| `@upstash/ratelimit` | ^2.0 | Sliding window rate limiter | Already in use. 20 req/hr per user on LLM endpoints |

### New Additions (Production Hardening)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/swagger` | ^11.x | OpenAPI/Swagger documentation | **Phase 6.** Decorate DTOs and controllers. Auto-generate via CLI plugin for minimal effort |
| `@nestjs/terminus` | ^11.x | Health checks with dependency verification | **Phase 6.** Verify Turso, Upstash, and optionally OpenRouter before serving traffic |
| `@sentry/nestjs` | Latest | Error tracking and performance monitoring | **Phase 6.** Auto-captures unhandled exceptions. `tracesSampleRate: 0.1` in production |
| `@nestjs/cache-manager` | ^11.x | Redis-backed caching | **Phase 7 (differentiator).** Cache categories (5 min TTL) and insights (1 min TTL) |
| `better-sqlite3` | Latest (dev) | In-memory SQLite for unit tests | **Phase 3.** Drizzle SQLite adapter for test isolation. Needs verification for libsql compatibility |
| `zod` | Latest | LLM response validation | **Phase 3 (optional differentiator).** Runtime validation of OpenRouter JSON output |
| `husky` + `lint-staged` | Latest (dev) | Git hooks for pre-commit quality | **Phase 7 (differentiator).** Run lint + tests on changed files before commit |

### Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| API docs | `@nestjs/swagger` | Manual OpenAPI YAML | NestJS Swagger auto-generates from DTOs — far less maintenance |
| Health checks | `@nestjs/terminus` | Manual health endpoint | Terminus provides structured indicators, standardized response format, timeout handling |
| Error tracking | `@sentry/nestjs` | PostHog, custom webhooks | Sentry is purpose-built for error tracking with NestJS integration. PostHog is product analytics |
| Caching | `@nestjs/cache-manager` + Redis | Manual Redis caching | NestJS CacheModule provides interceptor-based auto-caching with TTL |
| Test DB | `better-sqlite3` (in-memory) | Docker Turso, test-only Turso DB | In-memory is faster (no network), CI-friendly, Drizzle-compatible |
| Circuit breaker | `opossum` | None (deferred) | For single external dependency (OpenRouter) with `maxRetries: 1`, a full circuit breaker is over-engineering |
| Job queue | BullMQ, SQS | None (anti-feature) | LLM calls are synchronous (user waits). No async workloads at this scale |
| Monitoring dashboard | Grafana, DataDog | Vercel Analytics (built-in) | Vercel Pro includes function metrics. Additional tooling adds cost without proportional benefit |

## Installation

```bash
# Core production hardening additions
npm install @nestjs/swagger @nestjs/terminus @sentry/nestjs

# Caching (Phase 7 differentiator)
npm install @nestjs/cache-manager cache-manager

# Dev dependencies for testing
npm install -D better-sqlite3 @types/better-sqlite3

# Optional: LLM response validation
npm install zod

# Optional: Git hooks
npm install -D husky lint-staged
```

## Existing Dependencies (No Changes Needed)

The current `package.json` already has all core dependencies (NestJS 11, Drizzle ORM, Better Auth, OpenRouter SDK, Upstash Redis, Pino, Helmet, class-validator, class-transformer). No existing dependencies need upgrading or replacing for this hardening effort.

## Sources

| Source | URL |
|--------|-----|
| NestJS OpenAPI docs (Context7) | `@nestjs/swagger` official documentation |
| NestJS Terminus docs (Context7) | `@nestjs/terminus` official documentation |
| NestJS Caching docs (Context7) | `@nestjs/cache-manager` official documentation |
| NestJS Testing docs (Context7) | `Test.createTestingModule()` official documentation |
| Drizzle ORM migration docs (Context7) | `drizzle-kit generate` + `drizzle-kit migrate` |
| current `package.json` | `/Users/tri.le/Personal/chi-expense-be/package.json` |
