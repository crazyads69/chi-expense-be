# Phase 9: API Versioning - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce URI-based API versioning (/api/v1/) while maintaining backward compatibility with existing /api/ routes. All endpoints should be available under both versioned and unversioned paths.

</domain>

<decisions>
## Implementation Decisions

### Versioning Strategy
- URI-based versioning: `/api/v1/transactions`
- Keep unversioned routes working: `/api/transactions`
- Default version for unversioned routes: '1'
- Use NestJS built-in `@Version()` decorator

### Migration Approach
- Phase 1 (this phase): Add versioned routes alongside existing
- Phase 2 (future): Deprecate unversioned after mobile app adoption

### the agent's Discretion
- Swagger should show both paths or prefer versioned
- No breaking changes to existing mobile app

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- All controllers in src/*/*.controller.ts
- Swagger already configured in main.ts
- Route prefixes already set in controllers

### Established Patterns
- @Controller('api/...') pattern
- Swagger decorators on all endpoints

### Integration Points
- main.ts: add app.enableVersioning()
- All controllers: add @Version('1')

</code_context>

<specifics>
## Specific Ideas

- Use VersioningType.URI from @nestjs/common
- Set defaultVersion to VERSION_NEUTRAL or '1'
- Controllers opt-in with @Version('1')

</specifics>

<deferred>
## Deferred Ideas

- Header-based versioning
- Content negotiation
- Deprecation warnings on unversioned routes

</deferred>
