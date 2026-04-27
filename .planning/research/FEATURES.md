# Research: Features for v1.1

**Research Date:** 2026-04-27
**Milestone:** v1.1 — Production Maturity & Scalability
**Dimension:** Features

---

## Feature Categories

### Category 1: App Store Compliance (Critical)

**Apple Sign-In OAuth (DIF-02)**
- **Table Stakes:** Sign in with Apple button, callback handling, account linking
- **Differentiators:** Hide email forwarding, real user status verification
- **Complexity:** Medium — requires Apple Developer account, key generation, domain verification
- **Dependencies:** None (Better Auth supports natively)

**Why This Matters:**
App Store Review Guideline 4.8 mandates Sign in with Apple if app uses third-party login. Rejection risk without it.

---

### Category 2: Performance & Caching

**Redis Categories Cache (DIF-01)**
- **Table Stakes:** Cache GET /api/categories in Redis (60s TTL)
- **Differentiators:** Hit/miss logging, cache invalidation on category change
- **Complexity:** Low — already have Redis client
- **Dependencies:** None

**Server-side Image Resize (DIF-12)**
- **Table Stakes:** Resize to 800px width before LLM, convert to JPEG
- **Differentiators:** Smart cropping, quality optimization (85%)
- **Complexity:** Medium — Sharp integration, error handling for malformed images
- **Dependencies:** Sharp library

**Why These Matter:**
- Cache reduces DB reads by ~40% (categories are read-heavy, write-rare)
- Image resize reduces LLM cost by ~90% (15MB → 200KB)

---

### Category 3: Observability & Tracing

**Sentry Performance Tracing (DIF-03)**
- **Table Stakes:** Trace LLM API call latency (request → response)
- **Differentiators:** Trace full pipeline (resize → parse → save → response)
- **Complexity:** Low — Sentry SDK supports this natively
- **Dependencies:** None (Sentry already installed)

**x-request-id Correlation (DIF-04)**
- **Table Stakes:** Generate UUID per request, propagate to logs and Sentry
- **Differentiators:** Include in response headers for client tracing
- **Complexity:** Low — NestJS interceptor + AsyncLocalStorage
- **Dependencies:** None

**Why These Matter:**
- Without tracing, debugging production issues is guesswork
- Request IDs let you trace a single expense creation from mobile → backend → LLM → DB

---

### Category 4: API Evolution

**API Versioning (DIF-06)**
- **Table Stakes:** `/api/v1/` prefix, version in URL
- **Differentiators:** Deprecation headers, sunset policy
- **Complexity:** Low — NestJS decorator-based
- **Dependencies:** None

**Why This Matters:**
- Mobile apps cache API responses and behavior. Breaking changes crash old app versions.
- Stripe has API versions from 2011 still supported. Versioning is a commitment to stability.

---

### Category 5: Reliability

**Graceful Shutdown (DIF-07)**
- **Table Stakes:** Handle SIGTERM, finish in-flight requests
- **Differentiators:** Health endpoint reports "shutting down" during drain
- **Complexity:** Low — NestJS `enableShutdownHooks()`
- **Dependencies:** None

**Request Timeout Interceptor (DIF-08)**
- **Table Stakes:** 408 after 25s (under Vercel's 30s limit)
- **Differentiators:** Different timeouts per route (LLM: 25s, CRUD: 10s)
- **Complexity:** Low — RxJS timeout operator
- **Dependencies:** None

**Why These Matter:**
- Vercel kills requests at 30s with 504. Better to return 408 with a clear message.
- Graceful shutdown prevents data corruption during deployments.

---

### Category 6: Developer Experience

**Shared Utility Extraction (DIF-05)**
- **Table Stakes:** Extract `parseMonth()`, `formatDate()`, `calculateTotal()`
- **Differentiators:** Pure functions, comprehensive unit tests
- **Complexity:** Low — refactor existing code
- **Dependencies:** None

**Staging Environment (DIF-10)**
- **Table Stakes:** Separate Turso DB, separate Redis, `.env.staging`
- **Differentiators:** GitHub Actions deploy preview on PR
- **Complexity:** Medium — environment config management
- **Dependencies:** None

**Why These Matter:**
- DRY utilities reduce bugs (same logic everywhere)
- Staging prevents production incidents (test changes before deploy)

---

## Complexity Summary

| Feature | Complexity | Risk | Priority |
|---------|-----------|------|----------|
| Apple OAuth | Medium | High (App Store) | P0 |
| Redis caching | Low | Low | P1 |
| Sentry tracing | Low | Low | P1 |
| Request ID | Low | Low | P1 |
| API versioning | Low | Low | P2 |
| Graceful shutdown | Low | Low | P2 |
| Timeout interceptor | Low | Low | P2 |
| Image resize | Medium | Medium | P1 |
| Utility extraction | Low | Low | P2 |
| Staging config | Medium | Low | P2 |

---

## Table Stakes vs Differentiators

**Table Stakes (must have for production maturity):**
- Apple OAuth
- Redis caching
- Request tracing
- Graceful shutdown
- Timeout handling

**Differentiators (nice to have, competitive advantage):**
- Sentry performance tracing spans
- API versioning with deprecation policy
- Staging environment automation
- Smart image quality optimization
