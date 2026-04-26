# Plan 02-01: CORS + Rate Limiter + OAuth Validation — Summary

**Executed:** 2026-04-26
**Status:** Complete

## Changes Made

### Task 1: Restrict CORS origin (`src/main.ts`)
- Replaced `origin: true` with dynamic function checking `allowedOrigins` array
- Allowed origins: `FRONTEND_URL`, `chi-expense://`, `exp://`, and `null` (for mobile apps)
- `credentials: true` preserved for Better Auth session cookies

### Task 2: Rate limiter hardening (`src/input/rate-limit.guard.ts`)
- Removed IP-based rate limiting fallback (x-forwarded-for spoofing vector)
- Unauthenticated requests to LLM endpoints now return 401 Unauthorized
- Session ID (`request.user?.id`) is the sole identity source — Bearer token fallback removed

### Task 3: Environment validation (`src/app.module.ts`)
- Added `EnvironmentVariables` class with `class-validator` decorators
- Added `validate()` function passed to `ConfigModule.forRoot()`
- Validates 6 required env vars at startup: `BETTER_AUTH_SECRET`, `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENROUTER_API_KEY`
- Descriptive error messages tell developer which var is missing

## Verification Results

| Check | Result |
|-------|--------|
| `allowedOrigins` in main.ts | PASS |
| No `origin: true` in main.ts | PASS |
| `UNAUTHORIZED` in rate-limit.guard.ts | PASS |
| No `x-forwarded-for` in rate-limit.guard.ts (except comment) | PASS |
| `request.user?.id` only identity source | PASS |
| `validate` in app.module.ts | PASS |
| `EnvironmentVariables` class in app.module.ts | PASS |
| All 6 required env vars validated | PASS |
| `npm run build` exits 0 | PASS |

## Requirements Satisfied
- SEC-01: CORS restricted to configured allowlist
- SEC-02: Rate limiter returns 401 for unauthenticated LLM requests
- SEC-04: OAuth secrets validated at startup
