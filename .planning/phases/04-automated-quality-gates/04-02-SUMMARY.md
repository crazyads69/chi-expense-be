# Plan 04-02: Input, Insights & RateLimitGuard Unit Tests — Summary

**Executed:** 2026-04-26
**Status:** Complete

## Changes Made

### Task 1: InputService unit tests (`src/input/input.service.spec.ts`)
- Mocked OpenAI client via `jest.mock('../lib/openrouter')`
- Tests merchant map fallback (no LLM call)
- Tests LLM success, missing JSON, invalid JSON
- Tests API timeout/network errors (503)
- Tests partial JSON fallback
- Tests parseImage success and error paths
- Tests utility methods: parseAmount, lookupMerchant, extractMerchant, sanitizeUserMessage

### Task 2: InsightsService unit tests (`src/insights/insights.service.spec.ts`)
- Tests monthly insights with multiple categories and dates
- Tests empty month returns zeros
- Tests invalid month throws BadRequestException

### Task 3: RateLimitGuard unit tests (`src/input/rate-limit.guard.spec.ts`)
- Mocked Redis client via `jest.mock('../lib/redis')`
- Tests authenticated user within rate limit returns true
- Tests unauthenticated user throws 401
- Tests rate limit exceeded throws 429

## Bug Fix
- Fixed `parseAmount` in `src/input/input.service.ts` to correctly handle decimal + `k` suffix (e.g., `100.5k` → `100500` instead of `1005000`)

## Verification Results

| Check | Result |
|-------|--------|
| `src/input/input.service.spec.ts` passes (16 tests) | PASS |
| `src/insights/insights.service.spec.ts` passes | PASS |
| `src/input/rate-limit.guard.spec.ts` passes | PASS |

## Requirements Satisfied
- QAL-01: Unit tests for InputService, InsightsService, RateLimitGuard
- QAL-02: Utility tests for parseAmount (Vietnamese regex)
