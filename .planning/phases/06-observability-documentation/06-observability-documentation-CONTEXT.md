# Phase 6: Observability & Documentation - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add production monitoring, structured health checks, API documentation, and deployment hardening — ensuring the backend is observable and well-documented before multi-user launch. This phase covers:
- Sentry error tracking integration
- Health endpoint with dependency verification
- Swagger/OpenAPI documentation at /api/docs
- Vercel runtime configuration verification

</domain>

<decisions>
## Implementation Decisions

### Sentry Integration
- Use `@sentry/nestjs` official SDK for automatic NestJS exception filtering
- Capture all unhandled exceptions with HTTP context (URL, method, headers)
- Configure DSN via `SENTRY_DSN` environment variable with startup validation

### Health Check Depth
- Database check: `db.get(sql\`SELECT 1\`)` lightweight ping
- Redis check: `redis.ping()` via Upstash REST client
- Degraded state returns HTTP 200 with `{ database: 'disconnected' }` and logs warning

### Swagger Documentation Scope
- Bearer token auth button in Swagger UI for authenticated endpoints
- All request/response DTOs documented with `@ApiProperty` and examples
- Group endpoints by domain: Auth, Transactions, Input, Insights, Categories, Account

### the agent's Discretion
- Health check response format follows NestJS Terminus patterns if available, otherwise custom implementation
- Swagger setup uses standard `@nestjs/swagger` DocumentBuilder with custom title/description

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `health.controller.ts` exists at `src/health.controller.ts` — currently returns basic `{ status: 'ok', timestamp }`
- `main.ts` has bootstrap function with app initialization — Sentry should be initialized before app creation
- All controllers and DTOs are already implemented across 5 domains

### Established Patterns
- NestJS standard module/controller/service pattern
- Environment variables validated via `ConfigModule.forRoot({ validate })` (established in Phase 3)
- `@AllowAnonymous()` decorator from `@thallesp/nestjs-better-auth` for public endpoints
- Structured logging with `nestjs-pino` already configured

### Integration Points
- HealthController needs to inject database client (DRIZZLE token) and Redis client
- Sentry integration requires bootstrap-level initialization + global exception filter
- Swagger setup in `main.ts` after app creation, before `app.init()`
- All existing controllers need `@ApiTags`, `@ApiOperation`, `@ApiResponse` decorators

</code_context>

<specifics>
## Specific Ideas

- OBS-04 (vercel.json runtime) is already complete — verified in codebase
- Use NestJS `@nestjs/terminus` for health checks if available, otherwise extend existing HealthController
- Swagger document title: "Chi Expense API" — version from package.json
- Sentry should capture exceptions in both Vercel serverless and local dev environments

</specifics>

<deferred>
## Deferred Ideas

- Sentry performance tracing for LLM spans (DIF-03 — deferred to v1.1)
- PostHog product analytics (DIF-11 — deferred to v1.1)
- API versioning strategy /api/v1/ (DIF-06 — deferred to v1.1)

</deferred>
