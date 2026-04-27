# Phase 11: Caching & Performance Tracing - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Redis caching for categories (read-heavy, rarely changed) and add Sentry performance tracing for LLM operations and slow database queries.

</domain>

<decisions>
## Implementation Decisions

### Caching Strategy
- Cache-aside (lazy loading) pattern
- Categories cached with 60s TTL
- Cache key: `categories:{userId}`
- Hit/miss metrics logged via Pino

### Performance Tracing
- Sentry `tracesSampleRate: 0.1` (10% of requests)
- LLM spans: measure OpenRouter call duration
- DB spans: measure queries >100ms

### the agent's Discretion
- Use existing Redis client (getRedisClient())
- Add cache prefix to avoid key collisions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/redis.ts` — getRedisClient() singleton
- `src/categories/categories.service.ts` — list() method
- Sentry already initialized
- Request context already implemented

### Established Patterns
- Service layer handles business logic
- Redis used for rate limiting

### Integration Points
- CategoriesService needs cache logic
- InputService/InsightsService need tracing spans

</code_context>

<specifics>
## Specific Ideas

- Cache invalidation: delete key on category write (if any)
- For v1.1, categories are read-only (lazy init), so TTL is sufficient
- Use Sentry.startSpan() for LLM calls

</specifics>

<deferred>
## Deferred Ideas

- Cache warming
- Probabilistic early expiration
- Full query tracing for all DB operations

</deferred>
