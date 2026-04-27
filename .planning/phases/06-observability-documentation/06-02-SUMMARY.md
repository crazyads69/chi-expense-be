# Plan 06-02 Summary: Health Check Enhancement

**Status:** Complete ✅
**Requirements:** OBS-02

## What Was Done

1. **Enhanced `src/health.controller.ts`** — Replaced basic liveness check with dependency verification:
   - Injected `DRIZZLE` token for database access
   - Added `SELECT 1` database connectivity check
   - Added Redis `ping()` connectivity check via `getRedisClient()`
   - Returns `{ status: 'ok' | 'degraded', database: 'connected' | 'disconnected', redis: 'connected' | 'disconnected', timestamp }`
   - Degraded state returns HTTP 200 (standard for health endpoints) with disconnected status

2. **Created `src/health.controller.spec.ts`** — Unit tests for health controller:
   - Tests "ok" status when all dependencies are healthy
   - Tests "degraded" status when database is down
   - Mocks Redis client to avoid external dependency in tests

## Key Decisions

- HTTP 200 returned even for degraded state — deployment systems and load balancers expect the endpoint to exist
- Errors are logged internally but not exposed in response body
- `getRedisClient()` singleton pattern preserved; mocked in tests

## Verification

- `npm run build` passes
- `npm test` passes (health.controller.spec.ts: 2 tests)
- Health endpoint returns correct shape with dependency status

## Files Modified

- `src/health.controller.ts` — Enhanced with DB and Redis checks + Swagger decorators
- `src/health.controller.spec.ts` — New test file
- `package.json` — Updated jest `transformIgnorePatterns` to include `better-auth` and `@thallesp/nestjs-better-auth`
