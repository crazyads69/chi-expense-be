# Phase 10: Apple Sign-In OAuth - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Apple Sign-In OAuth provider for App Store compliance, supporting both web and native iOS flows with account linking.

</domain>

<decisions>
## Implementation Decisions

### Provider Setup
- Use Better Auth's built-in Apple provider
- Generate client secret JWT using Apple's private key
- Support both web and native (iOS) flows

### Account Linking
- Existing GitHub users can link Apple identity
- Same email = same account (if email is shared)
- Different email = account linking via settings (future)

### Key Management
- Apple private key stored in env var
- Client secret generated on-demand (no caching needed, JWT is short-lived)
- Document key rotation process (6-month Apple expiry)

### the agent's Discretion
- Use `@better-auth/expo` for native iOS flow
- Web flow handled by Better Auth automatically

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/auth.ts` — Better Auth configuration
- `src/app.module.ts` — AuthModule setup
- Environment variable validation pattern

### Established Patterns
- OAuth providers configured in `src/lib/auth.ts`
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` env vars

### Integration Points
- Add Apple provider to `auth` object
- Add Apple env vars to `EnvironmentVariables` class
- Update `.env.example`

</code_context>

<specifics>
## Specific Ideas

- Apple requires: clientId (Services ID), clientSecret (JWT), teamId, keyId
- Client secret JWT: signed with Apple private key, expires in 6 months max
- Use `jsonwebtoken` or `jose` library to generate JWT

</specifics>

<deferred>
## Deferred Ideas

- Account linking UI (mobile app feature)
- Multiple OAuth provider linking

</deferred>
