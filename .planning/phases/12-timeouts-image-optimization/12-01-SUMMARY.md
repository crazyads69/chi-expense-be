# Phase 12 Summary: Timeouts & Image Optimization

**Completed:** 2026-04-27
**Status:** Done

## What Changed

### 1. Timeout Interceptor (`src/lib/timeout.interceptor.ts`)
- Global NestJS interceptor applied via `app.useGlobalInterceptors()`
- LLM endpoints (`/api/input/text`, `/api/input/image`): 25s timeout
- All other CRUD endpoints: 10s timeout
- Returns HTTP 408 with message "Request timeout — please retry" on timeout

### 2. Image Resizing (`src/lib/image-resize.ts`)
- Server-side image resize using `sharp` before LLM API call
- Max 800px width (preserving aspect ratio, no enlargement)
- Converts to JPEG at 85% quality with mozjpeg optimization
- Enforces <1MB output size
- Returns clear 422 errors for invalid/corrupted images

### 3. Integration (`src/input/input.service.ts`)
- `parseImage()` now resizes images before sending to OpenRouter
- Resize failures throw `HttpException(422)` with descriptive message

## Files Modified
- `src/lib/timeout.interceptor.ts` (new)
- `src/lib/image-resize.ts` (new)
- `src/main.ts`
- `src/input/input.service.ts`
- `src/input/input.service.spec.ts`
- `test/app.e2e-spec.ts`

## Dependencies
- `sharp` ^0.33.5 (installed)

## Verification
- `npm run build` passes
- `npm test` passes (62 tests)
- `npm run test:e2e` passes (12 tests)

## Requirements Coverage
| Requirement | Status |
|-------------|--------|
| TMO-01 | Done |
| TMO-02 | Done |
| TMO-03 | Done |
| TMO-04 | Done |
| IMG-01 | Done |
| IMG-02 | Done |
| IMG-03 | Done |
