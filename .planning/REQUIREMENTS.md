# Requirements: Chi Expense v1.1

**Defined:** 2026-04-27
**Milestone:** v1.1 — Production Maturity & Scalability
**Core Value:** Log an expense in 2 seconds with zero UI friction

## v1.1 Requirements

Requirements for production maturity milestone. Each maps to a roadmap phase.

### App Store Compliance

- [x] **APL-01**: Apple Sign-In OAuth provider configured and working end-to-end (web + native iOS flow)
- [x] **APL-02**: Apple client secret JWT auto-generated and rotates correctly (6-month expiry handled)
- [x] **APL-03**: Account linking works — existing GitHub users can link Apple identity without data loss

### Performance & Scalability

- [x] **CCH-01**: Categories list (`GET /api/categories`) served from Redis cache with 60s TTL
- [x] **CCH-02**: Cache hit/miss metrics logged with structured Pino logs (count and ratio)
- [x] **CCH-03**: Cache invalidation on category mutation (write-through or delete-on-update)
- [x] **IMG-01**: Receipt images resized server-side to max 800px width before LLM API call
- [x] **IMG-02**: Resized images converted to JPEG with 85% quality, target size < 1MB
- [x] **IMG-03**: Image resize errors return 422 with clear message (invalid format, corrupted data)

### Observability

- [x] **TRC-01**: Every request generates or propagates `x-request-id` UUID
- [x] **TRC-02**: Request ID included in all Pino log entries for that request
- [x] **TRC-03**: Request ID included in Sentry scope for error tracking
- [x] **TRC-04**: Response headers include `x-request-id` for client-side tracing
- [x] **PER-01**: Sentry performance tracing enabled with `tracesSampleRate: 0.1`
- [x] **PER-02**: LLM parsing spans measure full duration (request → OpenRouter → response)
- [x] **PER-03**: Database query spans measure slow queries (>100ms)

### API Evolution

- [x] **VER-01**: All endpoints available under `/api/v1/` prefix
- [x] **VER-02**: Unversioned `/api/` routes continue working (backward compatible)
- [x] **VER-03**: Controllers use `@Version('1')` decorator
- [x] **VER-04**: Swagger docs reflect versioned paths

### Reliability

- [x] **GRF-01**: Graceful shutdown handles SIGTERM — finishes in-flight requests before exit
- [x] **GRF-02**: Health endpoint returns 503 during shutdown (load balancer removes instance)
- [x] **GRF-03**: Shutdown completes within 10 seconds
- [x] **TMO-01**: Request timeout interceptor returns 408 after 25 seconds
- [x] **TMO-02**: LLM endpoints (input/text, input/image) have 25s timeout
- [x] **TMO-03**: CRUD endpoints have 10s timeout
- [x] **TMO-04**: Timeout errors include clear message: "Request timeout — please retry"

### Developer Experience

- [x] **UTL-01**: Duplicate date/month parsing logic extracted to shared utility
- [x] **UTL-02**: Duplicate formatting logic extracted to shared utility
- [x] **UTL-03**: All extracted utilities have unit tests
- [x] **STG-01**: `.env.staging` file documents staging environment variables
- [x] **STG-02**: Staging config uses separate Turso database and Redis instance
- [x] **STG-03**: Documentation explains how to deploy to staging vs production

## Future Requirements

Deferred to v1.2+ milestones. Tracked but not in current roadmap.

### Analytics & Growth (v1.2)

- **ANL-01**: PostHog product analytics integration
- **ANL-02**: Feature usage tracking (input method breakdown, category distribution)
- **ANL-03**: Funnel analysis (sign up → first expense → retention)

### Advanced Features (v1.2+)

- **PUSH-01**: Push notifications for budget alerts — v1.2
- **PUSH-02**: Daily spending summary notification — v1.2
- **MULTI-01**: Multi-currency support — v3.0
- **BATCH-01**: Batch expense detection (multiple items per message) — future

## Out of Scope

| Feature | Reason |
|---------|--------|
| Microservices / service mesh | Over-engineering for <1000 users |
| Message queue (Bull/BullMQ) | No async workloads requiring queue |
| GraphQL API | REST sufficient for mobile app |
| WebSocket support | Not compatible with Vercel serverless |
| PostgreSQL migration | Turso free tier sufficient for current scale |
| RevenueCat subscriptions | v2.0 feature |

## Traceability

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

**Coverage:**
- v1.1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after research synthesis*
