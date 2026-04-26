# Phase 2: Security Hardening - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

## Phase Boundary

Fix critical security vulnerabilities identified in the codebase audit — restrict CORS to configured allowlist, harden rate limiting to prevent IP spoofing, sanitize LLM inputs against prompt injection, validate OAuth secrets at startup, and validate image base64 payloads. No API behavior changes for legitimate users.

## Implementation Decisions

### CORS origin restriction (SEC-01)
- **D-14:** Replace `origin: true` in `main.ts` with a dynamic function that checks the request origin against an allowlist: `[FRONTEND_URL, null]`. `null` origin is required for mobile app WebView/auth flows.
- **D-15:** Keep `credentials: true` — required for Better Auth session cookies.
- **D-16:** The `AuthModule` has `disableTrustedOriginsCors: true` — our CORS config in `main.ts` is the sole source of truth.

### Rate limiter hardening (SEC-02)
- **D-17:** For LLM endpoints (`/api/input/text`, `/api/input/image`), unauthenticated requests must return 401 (not rate-limited-by-IP). These endpoints require auth and should not be accessible to anonymous users.
- **D-18:** Authenticated users are identified by `request.user.id` (Better Auth session). The Bearer token fallback is removed — session is the single source of identity.
- **D-19:** The `x-forwarded-for` IP-based fallback stays for non-LLM endpoints only (if needed later), but LLM endpoints (guarded by `RateLimitGuard`) now require authentication.

### LLM prompt injection mitigation (SEC-03)
- **D-20:** Sanitize user messages before inserting into prompts: strip JSON-like syntax (`{`, `}`, `[`, `]`), backticks, and control characters. This prevents users from hijacking the system prompt.
- **D-21:** Wrap sanitized user messages in delimiter markers (`<<<USER_MESSAGE>>>` / `<<<END_USER_MESSAGE>>>`) so the LLM can distinguish user content from instructions even if sanitization misses edge cases.
- **D-22:** Update `USER_PROMPT_TEMPLATE` in `src/lib/prompts.ts` to use the delimiter-wrapped format.

### OAuth secret validation (SEC-04)
- **D-23:** At app startup, validate that `GITHUB_CLIENT_SECRET` is set (non-empty) when `GITHUB_CLIENT_ID` is set. Better Auth silently fails with empty strings — we catch this early.
- **D-24:** Use `ConfigModule.forRoot({ validate })` with a `validate` function that checks required env vars and throws descriptive errors. This is the NestJS idiomatic way.
- **D-25:** Required env vars for v1.0: `BETTER_AUTH_SECRET`, `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OPENROUTER_API_KEY`.
- **D-26:** Keep optional env vars as optional (UPSTASH_REDIS*, FRONTEND_URL, APPLE_*).

### Image base64 validation (SEC-05)
- **D-27:** Validate that `imageBase64` starts with `data:image/jpeg;base64,` or `data:image/png;base64,` before passing to the LLM. Reject with 400 Bad Request if not.
- **D-28:** The validation happens in `InputController` (via DTO or guard) — fail fast before service logic or LLM API call.
- **D-29:** Remove the auto-prefix logic in `InputService.parseImage` that silently wraps bare base64 with `data:image/jpeg;base64,`.

## Specific Ideas

- CORS dynamic origin function should log rejected origins at `debug` level for troubleshooting
- Rate limiter 401 for unauthenticated LLM requests should include `WWW-Authenticate: Bearer` header per RFC 6750
- LLM input sanitization regex should be conservative — strip anything that looks like prompt manipulation
- Env validation errors should be user-friendly: `"GITHUB_CLIENT_SECRET is required but not set. Check your .env file."`

## Canonical References

### Security configuration
- `src/main.ts` — CORS configuration (lines 31-36)
- `src/input/rate-limit.guard.ts` — Rate limiting logic
- `src/lib/auth.ts` — OAuth provider configuration (lines 16-25)
- `src/app.module.ts` — ConfigModule setup (line 15)

### LLM input handling
- `src/input/input.service.ts` — `parseText()` (lines 72-126) and `parseImage()` (lines 128-190)
- `src/lib/prompts.ts` — `SYSTEM_PROMPT` and `USER_PROMPT_TEMPLATE`
- `src/input/input.controller.ts` — Endpoint definitions
- `src/input/dto/image-input.dto.ts` — Image DTO

### Project docs
- `.planning/REQUIREMENTS.md` — SEC-01 through SEC-05
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `.planning/codebase/CONCERNS.md` — Security concerns (CORS, rate limiter, prompt injection)

## Existing Code Insights

### Reusable Assets
- `RateLimitGuard` already has auth detection logic — just needs to flip the unauthenticated branch from IP-limiting to 401
- `ConfigModule.forRoot` already imported — just needs `validate` function added
- `TextInputDto` and `ImageInputDto` exist — image validation can be added to DTO or controller

### Established Patterns
- Guards use NestJS `CanActivate` interface
- DTOs use `class-validator` decorators
- Environment variables accessed via `process.env.*`
- `getOpenAIClient()` uses lazy initialization

### Integration Points
- `main.ts` — CORS config change
- `rate-limit.guard.ts` — Unauthenticated branch change
- `prompts.ts` — Prompt template update
- `input.service.ts` — Sanitization function + image validation
- `app.module.ts` — ConfigModule validate function

## Deferred Ideas

- Apple OAuth secret validation — deferred until Apple Sign-In is implemented (v1.1)
- Advanced prompt injection detection (LLM-based) — overkill for v1.0
- Content Security Policy headers — not applicable (API-only backend)
- Rate limiter per-endpoint differentiation — not needed at current scale

---

*Phase: 02-security-hardening*
*Context gathered: 2026-04-26*
