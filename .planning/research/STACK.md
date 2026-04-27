# Research: Stack Additions for v1.1

**Research Date:** 2026-04-27
**Milestone:** v1.1 — Production Maturity & Scalability
**Dimension:** Stack

---

## Existing Validated Stack (DO NOT change)

- **Framework:** NestJS 11, TypeScript 5.7
- **Database:** Turso (libSQL) + Drizzle ORM
- **Auth:** Better Auth 1.6
- **LLM:** OpenRouter via `openai` SDK
- **Rate Limiting:** Upstash Redis + `@upstash/ratelimit`
- **Logging:** `nestjs-pino`
- **Deployment:** Vercel serverless, Node.js 20.x

---

## New Stack Components Needed

### 1. Image Processing — Sharp

**Library:** `sharp` (Node.js image processing)
**Version:** ^0.33.x
**Why:** Fastest Node.js image resize. Native bindings, ~10x faster than ImageMagick/GraphicsMagick. Supports JPEG, PNG, WebP.
**Integration Point:** `src/input/` — resize before sending to OpenRouter
**Alternative:** `jimp` (pure JS, slower but no native deps) — reject for v1.1 since Vercel supports native modules in serverless

**Big Tech Standard:**
- Google Photos, Instagram use server-side resize before ML inference
- Sharp is industry standard for Node.js (used by Next.js Image Optimization)

**What NOT to add:**
- ImageMagick — too heavy for serverless
- Canvas API — overkill, not needed

---

### 2. Request Tracing — AsyncLocalStorage (Built-in)

**Library:** Node.js built-in `async_hooks` / `AsyncLocalStorage`
**Version:** Node.js 20.x (native)
**Why:** Zero-dependency request context propagation. Stores `x-request-id` per async context.
**Integration Point:** NestJS interceptor + middleware
**Alternative:** `cls-hooked` — deprecated, AsyncLocalStorage is the modern replacement

**Big Tech Standard:**
- Google uses request context bags (similar concept)
- OpenTelemetry uses AsyncLocalStorage for span context
- Netflix's Mantis uses thread-local-like context propagation

**What NOT to add:**
- Full OpenTelemetry — overkill for v1.1, adds significant complexity
- `continuation-local-storage` — deprecated

---

### 3. Graceful Shutdown — @nestjs/platform-express (Built-in)

**Library:** NestJS built-in `app.close()` + signal handlers
**Version:** NestJS 11 (native)
**Why:** No new dependency needed. NestJS has built-in graceful shutdown.
**Integration Point:** `src/main.ts` — add `enableShutdownHooks()`

**Big Tech Standard:**
- Kubernetes sends SIGTERM before SIGKILL (30s grace period)
- AWS ECS, Google Cloud Run respect graceful shutdown
- Standard pattern: stop accepting new requests → finish in-flight → close DB connections → exit

**What NOT to add:**
- `http-terminator` — NestJS handles this natively
- Custom signal handling libraries — unnecessary abstraction

---

### 4. Apple OAuth — Better Auth Plugin

**Library:** `@better-auth/oauth` or built-in Better Auth Apple provider
**Version:** Part of Better Auth 1.6
**Why:** Better Auth supports Apple OAuth natively. No additional auth library needed.
**Integration Point:** `src/lib/auth.ts` — add Apple provider config

**Big Tech Standard:**
- Apple Sign-In is mandatory for App Store approval (App Store Review Guideline 4.8)
- Must support both web and native (iOS) flows
- Better Auth handles both via `@better-auth/expo` for mobile

**What NOT to add:**
- Passport-Apple — redundant, Better Auth handles OAuth
- Custom JWT signing for Apple — Better Auth manages this

---

### 5. API Versioning — NestJS Built-in

**Library:** NestJS `@Version()` decorator + `VERSION_NEUTRAL`
**Version:** NestJS 11 (native)
**Why:** No new dependency. NestJS has URI-based versioning built-in.
**Integration Point:** `src/main.ts` — `app.enableVersioning()` + controller decorators

**Big Tech Standard:**
- Stripe: `/v1/charges`, `/v2/payment_intents`
- GitHub: `/v3/repos`, API version in Accept header
- URI versioning is most pragmatic for mobile apps (easy to see in URL)

**What NOT to add:**
- Header-based versioning — harder to debug on mobile
- Content negotiation — overkill for JSON APIs

---

### 6. Timeout Interceptor — NestJS Built-in

**Library:** `rxjs` timeout operator + NestJS interceptor
**Version:** Already in dependencies (`rxjs` ^7.8.1)
**Why:** No new dependency. RxJS has `timeout()` operator.
**Integration Point:** New `TimeoutInterceptor` in `src/lib/`

**Big Tech Standard:**
- Netflix Hystrix: circuit breaker + timeout patterns
- Google Cloud: default 60s request timeout
- Standard: 408 Request Timeout for client, 504 for gateway

---

## Summary Table

| Feature | Library | New Dependency? | Size Impact |
|---------|---------|----------------|-------------|
| Image resize | `sharp` | Yes | ~20MB (native) |
| Request tracing | `AsyncLocalStorage` | No | 0 |
| Graceful shutdown | NestJS built-in | No | 0 |
| Apple OAuth | Better Auth built-in | No | 0 |
| API versioning | NestJS built-in | No | 0 |
| Timeout | RxJS built-in | No | 0 |
| Redis caching | `@upstash/redis` | Already have | 0 |

**Total new dependencies:** 1 (`sharp`)
**Bundle impact:** Minimal — only Sharp adds significant size, but it's essential
