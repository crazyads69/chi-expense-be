# Phase 8: Request Context & Correlation IDs - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement request-scoped context propagation using Node.js AsyncLocalStorage to enable traceability across logs, errors, and external calls. This phase delivers:
- Unique `x-request-id` per request (generated or propagated)
- Request context available throughout the application lifecycle
- Integration with Pino logs and Sentry error tracking

</domain>

<decisions>
## Implementation Decisions

### Request ID Generation
- Use `crypto.randomUUID()` for generating request IDs
- Accept incoming `x-request-id` header from clients (mobile app)
- Fall back to generated UUID if no header provided

### Context Storage
- Use Node.js built-in `AsyncLocalStorage` (no external dependencies)
- Store minimal context: requestId, userId (optional), startTime
- Access via utility function `getRequestContext()`

### Integration Points
- NestJS middleware to set context at request start
- Pino logger auto-includes requestId from context
- Sentry scope updated with requestId
- Response header `x-request-id` sent back to client

### the agent's Discretion
- Interceptor vs middleware pattern — use NestJS interceptor for cleaner integration
- Context cleanup handled automatically by NestJS lifecycle

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nestjs-pino` already configured with structured logging
- `src/app.module.ts` has global providers setup
- Sentry already initialized in `src/main.ts`

### Established Patterns
- NestJS module/provider/controller pattern
- Middleware/interceptor pattern available
- `process.env` based configuration

### Integration Points
- Add interceptor to `app.module.ts` providers
- Modify logger configuration to include requestId
- Update Sentry scope in exception filter or interceptor

</code_context>

<specifics>
## Specific Ideas

- Keep AsyncLocalStorage store minimal (requestId only, maybe userId and startTime)
- Don't store large objects or full request/response in context
- Use NestJS `APP_INTERCEPTOR` token for global application

</specifics>

<deferred>
## Deferred Ideas

- Full OpenTelemetry tracing (overkill for v1.1)
- Request context in database queries (future enhancement)

</deferred>
