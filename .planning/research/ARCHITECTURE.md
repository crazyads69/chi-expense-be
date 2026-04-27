# Research: Architecture for v1.1

**Research Date:** 2026-04-27
**Milestone:** v1.1 — Production Maturity & Scalability
**Dimension:** Architecture

---

## Existing Architecture

```
Client (React Native)
  → Vercel Edge (NestJS handler)
    → CORS / Helmet
    → Better Auth (session validation)
    → Rate Limit Guard (Redis)
    → Controller
      → Service
        → Drizzle ORM → Turso (libSQL)
        → Redis (rate limiting)
        → OpenRouter (LLM)
    → Response
```

**Key characteristics:**
- Single-process serverless (Vercel Function)
- Cached server instance across warm invocations
- Stateless except for DB/Redis
- No message queues, no background jobs

---

## New Components & Integration Points

### 1. Request Context Propagation (x-request-id)

**Integration Point:** Entry middleware → all services → all external calls
**Pattern:** AsyncLocalStorage store with request-scoped UUID

```
Request arrives
  → Middleware: generate request-id (or use incoming header)
    → Store in AsyncLocalStorage
      → Logger auto-includes request-id
      → Sentry scope includes request-id
      → Redis calls include request-id tag
      → LLM calls include request-id header
  → Response header: x-request-id
```

**Build Order:** Early — affects all other features

---

### 2. Redis Cache Layer

**Integration Point:** `CategoriesService` (read-heavy, rarely changes)
**Pattern:** Cache-aside (lazy loading)

```
GET /api/categories
  → Check Redis: `categories:{userId}`
    → Hit: return cached, log hit
    → Miss: query DB, store in Redis (60s TTL), log miss
```

**Cache Invalidation:**
- TTL-based (simple, acceptable stale data for 60s)
- On write: delete cache key (future enhancement)

**Integration with existing:**
- Reuses `getRedisClient()` from `src/lib/redis.ts`
- Adds new `getCacheClient()` or uses same Redis instance with different key prefix

**Build Order:** After request context (needs logging)

---

### 3. Image Processing Pipeline

**Integration Point:** `InputService.parseImage()`
**Pattern:** Pre-process before LLM call

```
POST /api/input/image
  → Validate base64
    → Sharp resize (max 800px width, JPEG quality 85%)
      → Validate output < 1MB
        → Send to OpenRouter
          → Parse response
            → Save transaction
```

**Error Handling:**
- Invalid image → 400 Bad Request
- Resize failure → 422 Unprocessable Entity
- LLM timeout → 408 (handled by timeout interceptor)

**Integration with existing:**
- Extends `InputService`
- Reuses OpenRouter client

**Build Order:** After timeout interceptor (needs timeout protection)

---

### 4. API Versioning

**Integration Point:** Global routing + controllers
**Pattern:** URI versioning with NestJS built-in

```
Current: /api/transactions
New:     /api/v1/transactions

Approach:
- app.enableVersioning({ type: VersioningType.URI })
- Default version: '1'
- Controllers opt-in with @Version('1')
- Legacy routes redirect or stay unversioned (backward compat)
```

**Migration Strategy:**
- Phase 1: Add `/api/v1/` alongside existing `/api/` (backward compatible)
- Phase 2: Mobile app migrates to `/api/v1/`
- Phase 3: Deprecate unversioned routes (future milestone)

**Integration with existing:**
- All controllers need `@Version('1')` decorator
- Swagger docs update to reflect versioned paths

**Build Order:** Early — affects all routes

---

### 5. Graceful Shutdown

**Integration Point:** Bootstrap + health endpoint
**Pattern:** NestJS built-in + custom drain

```
SIGTERM received
  → Set shuttingDown = true
    → Health endpoint returns 503 (load balancer removes from pool)
      → Wait for in-flight requests (max 10s)
        → Close DB connections
          → Close Redis connections
            → process.exit(0)
```

**Vercel-specific:**
- Vercel sends SIGTERM before killing container
- Must complete within function timeout (30s)
- Cached server pattern complicates this (need to track active requests)

**Integration with existing:**
- Modifies `bootstrap()` in `main.ts`
- Adds request tracking to count in-flight requests

**Build Order:** Late — infrastructure feature, doesn't block others

---

### 6. Apple OAuth

**Integration Point:** Better Auth configuration
**Pattern:** OAuth provider addition

```
src/lib/auth.ts
  → Add apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: generateAppleClientSecret(), // JWT signed with Apple private key
    })

Mobile flow:
  → iOS app uses better-auth/expo
  → Native Apple Sign-In → token → backend
  → Backend validates with Apple → creates/links account
```

**Integration with existing:**
- Extends existing `auth` object in `src/lib/auth.ts`
- Reuses session management
- May need new env vars: APPLE_CLIENT_ID, APPLE_PRIVATE_KEY, APPLE_TEAM_ID, APPLE_KEY_ID

**Build Order:** P0 — App Store blocker

---

## Suggested Build Order

| Order | Feature | Reason |
|-------|---------|--------|
| 1 | Request ID + Context | Foundation for all observability |
| 2 | API Versioning | Affects all route definitions |
| 3 | Apple OAuth | App Store blocker (P0) |
| 4 | Sentry Tracing | Builds on request context |
| 5 | Redis Caching | Independent, high impact |
| 6 | Timeout Interceptor | Protects LLM endpoints |
| 7 | Image Resize | Needs timeout protection |
| 8 | Graceful Shutdown | Infrastructure, independent |
| 9 | Utility Extraction | Refactoring, can be ongoing |
| 10 | Staging Config | DevOps, independent |

---

## Data Flow Changes

### Before v1.1
```
Request → Auth → Rate Limit → Controller → Service → DB/LLM → Response
```

### After v1.1
```
Request → Request ID → Auth → Rate Limit → Version Router → Controller → Service → Cache? → DB/LLM → Response
                                          ↓
                                    Image Resize (if input/image)
                                          ↓
                                    Timeout Guard
                                          ↓
                                    Tracing Span
```

**New interceptors/middleware order:**
1. Request ID (outermost — first in, last out)
2. CORS / Helmet
3. Timeout Interceptor
4. Auth
5. Rate Limit
6. API Version Router
7. Controller
8. Tracing (wraps service calls)
