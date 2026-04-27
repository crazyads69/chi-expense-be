# Roadmap: Chi Expense v1.1

**Milestone:** v1.1 — Production Maturity & Scalability
**Created:** 2026-04-27
**Phases:** 6 | **Requirements:** 30 | Coverage: 100%
**Previous Milestone:** v1.0 (Phases 1-7) — Code Hardening & Production Readiness

---

## Phase 8: Request Context & Correlation IDs

**Goal:** Establish request-scoped context propagation using AsyncLocalStorage, enabling traceability across logs, errors, and external calls.

**Requirements:** TRC-01, TRC-02, TRC-03, TRC-04

**Success criteria:**
1. Every request has a unique `x-request-id` (generated or propagated from incoming header)
2. All Pino logs for a request include the `requestId` field
3. Sentry errors include the request ID in scope/tags
4. Response headers include `x-request-id` for client-side correlation

**UI hint:** no

---

## Phase 9: API Versioning

**Goal:** Introduce URI-based API versioning (/api/v1/) while maintaining backward compatibility with existing /api/ routes.

**Requirements:** VER-01, VER-02, VER-03, VER-04

**Success criteria:**
1. All endpoints respond to `/api/v1/{path}`
2. Existing `/api/{path}` routes continue working (no breaking change)
3. Controllers use `@Version('1')` decorator
4. Swagger UI reflects versioned paths and works with both versions

**UI hint:** no

---

## Phase 10: Apple Sign-In OAuth

**Goal:** Add Apple OAuth provider for App Store compliance, supporting both web and native iOS flows with account linking.

**Requirements:** APL-01, APL-02, APL-03

**Success criteria:**
1. Users can sign in with Apple via web and native iOS
2. Apple client secret JWT is auto-generated and valid
3. Existing GitHub users can link Apple identity without data loss
4. Key rotation process is documented (6-month Apple expiry)

**UI hint:** no

---

## Phase 11: Caching & Performance Tracing

**Goal:** Reduce database load with Redis caching for categories and add Sentry performance tracing for LLM operations.

**Requirements:** CCH-01, CCH-02, CCH-03, PER-01, PER-02, PER-03

**Success criteria:**
1. `GET /api/categories` returns cached data with 60s TTL
2. Cache hit/miss metrics appear in structured logs
3. Cache invalidates on category mutation
4. Sentry traces show LLM call duration spans
5. Database queries >100ms appear as slow query spans

**UI hint:** no

---

## Phase 12: Timeouts & Image Optimization

**Goal:** Protect LLM endpoints from Vercel kills with timeout handling, and reduce LLM costs by resizing images server-side.

**Requirements:** TMO-01, TMO-02, TMO-03, TMO-04, IMG-01, IMG-02, IMG-03

**Success criteria:**
1. Requests exceeding 25s return 408 with clear message
2. LLM endpoints have 25s timeout, CRUD endpoints have 10s timeout
3. Receipt images are resized to max 800px width before LLM
4. Resized images are JPEG at 85% quality, <1MB
5. Invalid images return 422 with descriptive error

**UI hint:** no

---

## Phase 13: Reliability & Developer Experience

**Goal:** Add graceful shutdown for zero-downtime deploys, extract shared utilities for DRY code, and document staging environment setup.

**Requirements:** GRF-01, GRF-02, GRF-03, UTL-01, UTL-02, UTL-03, STG-01, STG-02, STG-03

**Success criteria:**
1. SIGTERM triggers graceful shutdown within 10 seconds
2. Health endpoint returns 503 during shutdown
3. Duplicate date/month logic extracted to tested utilities
4. `.env.staging` documents staging environment config
5. Staging uses separate Turso DB and Redis instance

**UI hint:** no

---

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRC-01 | Phase 8 | Done |
| TRC-02 | Phase 8 | Done |
| TRC-03 | Phase 8 | Done |
| TRC-04 | Phase 8 | Done |
| VER-01 | Phase 9 | Done |
| VER-02 | Phase 9 | Done |
| VER-03 | Phase 9 | Done |
| VER-04 | Phase 9 | Done |
| APL-01 | Phase 10 | Done |
| APL-02 | Phase 10 | Done |
| APL-03 | Phase 10 | Done |
| CCH-01 | Phase 11 | Done |
| CCH-02 | Phase 11 | Done |
| CCH-03 | Phase 11 | Done |
| PER-01 | Phase 11 | Done |
| PER-02 | Phase 11 | Done |
| PER-03 | Phase 11 | Done |
| TMO-01 | Phase 12 | Done |
| TMO-02 | Phase 12 | Done |
| TMO-03 | Phase 12 | Done |
| TMO-04 | Phase 12 | Done |
| IMG-01 | Phase 12 | Done |
| IMG-02 | Phase 12 | Done |
| IMG-03 | Phase 12 | Done |
| GRF-01 | Phase 13 | Done |
| GRF-02 | Phase 13 | Done |
| GRF-03 | Phase 13 | Done |
| UTL-01 | Phase 13 | Done |
| UTL-02 | Phase 13 | Done |
| UTL-03 | Phase 13 | Done |
| STG-01 | Phase 13 | Done |
| STG-02 | Phase 13 | Done |
| STG-03 | Phase 13 | Done |

**Coverage:** 30/30 requirements mapped ✓

---

## Phase Dependencies

```
Phase 8 (Request Context) ───┬──→ Phase 9 (API Versioning) [independent]
                             │
                             ├──→ Phase 10 (Apple OAuth) [independent]
                             │
                             ├──→ Phase 11 (Caching + Tracing) [depends on Phase 8]
                             │
                             ├──→ Phase 12 (Timeouts + Image) [depends on Phase 9]
                             │
                             └──→ Phase 13 (Reliability + DX) [independent]
```

- **Phase 8 must be first** — request context is foundation for tracing and logging
- **Phase 9 should be early** — versioning affects all route definitions
- **Phase 10 is P0** — Apple OAuth is App Store blocker
- **Phase 11 depends on Phase 8** — tracing needs request context
- **Phase 12 depends on Phase 9** — timeout/image endpoints need versioning
- **Phase 13 is independent** — infrastructure and cleanup

---

*Roadmap created: 2026-04-27*
