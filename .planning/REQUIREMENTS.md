# Requirements: Chi Expense

**Defined:** 2026-04-26
**Milestone:** v1.0 — Code Hardening & Production Readiness
**Core Value:** Log an expense in 2 seconds with zero UI friction

## v1 Requirements

Requirements for code hardening milestone. Each maps to a roadmap phase.

### Database Foundation

- [ ] **DB-01**: Baseline database migrations exist with version history (`drizzle/` directory populated, `drizzle-kit generate` run)
- [ ] **DB-02**: Timestamp columns are consistent across all tables (transactions, categories use `integer` with `mode: 'timestamp_ms'`)
- [ ] **DB-03**: Missing index `idx_transactions_category` added on transactions.category for category-based queries
- [ ] **DB-04**: UNIQUE constraint handling in categories service uses `onConflictDoNothing()` instead of error string matching
- [ ] **DB-05**: Turso HTTP-based client (`@libsql/client/http`) used for serverless connection compatibility

### Security

- [ ] **SEC-01**: CORS restricts origins to configured allowlist (`FRONTEND_URL`, mobile custom schemes) instead of `origin: true`
- [ ] **SEC-02**: Rate limiter prefers authenticated user ID over spoofable `x-forwarded-for` header; returns 401 for unauthenticated LLM requests
- [ ] **SEC-03**: LLM prompt injection mitigated via input sanitization (strip JSON-like syntax, delimiter-wrapped user messages)
- [ ] **SEC-04**: OAuth client secrets validated at startup — throw descriptive error if missing, not empty string fallback
- [ ] **SEC-05**: Image input endpoint validates base64 prefix (`data:image/jpeg;base64,` or `data:image/png;base64,`) before processing

### Testing & Error Resilience

- [ ] **TST-01**: Database client is injectable via NestJS custom provider token (`DRIZZLE`), enabling test database swapping
- [ ] **TST-02**: In-memory SQLite database configured for test environment via Jest setup
- [ ] **TST-03**: LLM parsing failures propagate as HTTP 502/503 errors instead of silently returning `{ amount: 0, merchant: 'Unknown' }`
- [ ] **TST-04**: OpenRouter API client configured with 8s timeout and 1 retry for transient failures
- [ ] **TST-05**: All required environment variables validated at startup via `ConfigModule.forRoot({ validate })` with descriptive errors

### Automated Quality Gates

- [ ] **QAL-01**: Unit tests cover all 6 NestJS services (categories, transactions, input, insights, account, rate-limit guard)
- [ ] **QAL-02**: Unit tests cover utility functions (Vietnamese regex amount parsing, merchant keyword lookup, LLM prompt formatting)
- [ ] **QAL-03**: E2E tests cover all 10 API endpoints with happy-path scenarios using test database
- [ ] **QAL-04**: CI pipeline (GitHub Actions) runs `npm run lint`, `npm run test`, and `drizzle-kit check` on every PR

### Performance

- [ ] **PERF-01**: Transaction listing (`GET /api/transactions`) returns cursor-based paginated results with `{ data, total, hasMore }` metadata
- [ ] **PERF-02**: Monthly insights use SQL aggregation (`GROUP BY`, `SUM`, `COUNT`) instead of in-memory JavaScript `reduce()`
- [ ] **PERF-03**: Month filtering uses date range queries (`>= '2026-04-01' AND < '2026-05-01'`) instead of `LIKE 'YYYY-MM%'`
- [ ] **PERF-04**: `vercel.json` configured with `maxDuration: 30` for LLM endpoints and `runtime: nodejs20.x`

### Observability & Documentation

- [ ] **OBS-01**: Sentry captures all unhandled NestJS exceptions via global exception filter and bootstrap initialization
- [ ] **OBS-02**: Health endpoint (`GET /api/health`) verifies database connectivity and Redis ping, not just server liveness
- [ ] **OBS-03**: OpenAPI/Swagger documentation (`@nestjs/swagger`) available at `/api/docs` with all endpoints decorated
- [ ] **OBS-04**: `vercel.json` pins Node.js 20.x runtime explicitly to match `package.json` engines requirement

## Future Requirements

Deferred to post-v1.0 milestones. Tracked but not in current roadmap.

### Post-Launch Differentiators (v1.1+)

- **DIF-01**: Categories list cached in Redis with 60s TTL and instrumented hit/miss logging
- **DIF-02**: Apple Sign-In OAuth provider added for App Store compliance
- **DIF-03**: Sentry performance tracing enabled for LLM parsing spans
- **DIF-04**: Correlation IDs (x-request-id) propagated through all service calls
- **DIF-05**: Shared utility extraction (duplicate month parsing, date utils)
- **DIF-06**: API versioning strategy (`/api/v1/...`) for future breaking changes
- **DIF-07**: Graceful shutdown handler for local development (SIGTERM/SIGINT)
- **DIF-08**: Request timeout interceptor (408 for routes exceeding threshold)
- **DIF-09**: Legacy categories id/slug mapping removed (mobile client uses real database ID)
- **DIF-10**: Staging/preview environment with separate Turso database and Redis instance
- **DIF-11**: PostHog product analytics for feature usage tracking
- **DIF-12**: Server-side image resize before LLM API call (reduce payload from ~15MB to ~200KB)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Microservices / service mesh | Over-engineering for solo dev, <1000 users. Monolith scales to ~10K users on Vercel |
| Message queue (Bull/BullMQ) | No async workloads requiring queue. LLM calls are synchronous user-initiated |
| GraphQL API | REST is sufficient for current feature set. No nested/resource-heavy queries |
| WebSocket support | Not compatible with Vercel serverless. Not needed for expense tracking |
| Custom auth system | Better Auth is stable, well-maintained, and handles all current needs |
| Database migration to PostgreSQL | Turso free tier covers up to 1000 users. Migrate only when free tier is exceeded |
| Kubernetes / container orchestration | Vercel serverless platform handles scaling automatically |
| Multi-region deployment | Turso is edge-distributed. Single Vercel region is sufficient for Vietnam market |
| Custom Terraform / Pulumi IaC | Config complexity not justified for solo dev. Vercel dashboard + env vars sufficient |
| Real-time expense sync (WebSocket/SSE) | Vercel serverless limitation. HTTP polling sufficient for v1 |
| Timestamp TEXT→INTEGER migration for existing columns | High-risk, low-reward. LIKE queries work correctly on ISO text. Accept inconsistency for v1.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 2 | Pending |
| SEC-05 | Phase 2 | Pending |
| TST-01 | Phase 3 | Pending |
| TST-02 | Phase 3 | Pending |
| TST-03 | Phase 3 | Pending |
| TST-04 | Phase 3 | Pending |
| TST-05 | Phase 3 | Pending |
| QAL-01 | Phase 4 | Pending |
| QAL-02 | Phase 4 | Pending |
| QAL-03 | Phase 4 | Pending |
| QAL-04 | Phase 4 | Pending |
| PERF-01 | Phase 5 | Pending |
| PERF-02 | Phase 5 | Pending |
| PERF-03 | Phase 5 | Pending |
| PERF-04 | Phase 5 | Pending |
| OBS-01 | Phase 6 | Pending |
| OBS-02 | Phase 6 | Pending |
| OBS-03 | Phase 6 | Pending |
| OBS-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-26*
*Last updated: 2026-04-26 after research synthesis*
