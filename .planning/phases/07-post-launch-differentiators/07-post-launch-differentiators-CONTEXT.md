# Phase 7: Post-Launch Differentiators - Context

**Gathered:** 2026-04-27
**Status:** Deferred to v1.1

<domain>
## Phase Boundary

This phase is explicitly deferred to v1.1 milestone. Requirements DIF-01 through DIF-12 are tracked in REQUIREMENTS.md > Future but are not in scope for v1.0 Code Hardening & Production Readiness.

Deferred features include:
- Redis caching for categories (60s TTL)
- Apple Sign-In OAuth
- Sentry performance tracing
- x-request-id correlation headers
- API versioning
- Server-side image resize
- PostHog analytics

</domain>

<decisions>
## Implementation Decisions

### Deferred to v1.1
All requirements in this phase are deferred. No implementation decisions needed at this time.

</decisions>

<code_context>
## Existing Code Insights

No changes required for v1.0.

</code_context>

<specifics>
## Specific Ideas

None — phase deferred.

</specifics>

<deferred>
## Deferred Ideas

All phase requirements deferred to v1.1:
- DIF-01: Categories Redis cache
- DIF-02: Apple Sign-In
- DIF-03: Sentry performance tracing
- DIF-04: Correlation IDs
- DIF-05: Shared utility extraction
- DIF-06: API versioning
- DIF-07: Graceful shutdown
- DIF-08: Request timeout interceptor
- DIF-09: Legacy categories cleanup
- DIF-10: Staging environment
- DIF-11: PostHog analytics
- DIF-12: Server-side image resize

</deferred>
