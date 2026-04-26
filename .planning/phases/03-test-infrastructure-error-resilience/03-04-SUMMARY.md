# Plan 03-04: Migrate Services to Dependency Injection — Summary

**Executed:** 2026-04-26
**Status:** Complete

## Changes Made

Migrated all 4 NestJS services from singleton `db` import to `@Inject(DRIZZLE)` constructor injection:

| Service | File |
|---------|------|
| TransactionsService | `src/transactions/transactions.service.ts` |
| InsightsService | `src/insights/insights.service.ts` |
| CategoriesService | `src/categories/categories.service.ts` |
| AccountService | `src/account/account.service.ts` |

Changes per service:
1. Replaced `import { db } from '../db/client'` with `DRIZZLE` token + `DrizzleDatabase` type imports
2. Added `Inject` to `@nestjs/common` import
3. Added constructor with `@Inject(DRIZZLE)` and `private readonly db: DrizzleDatabase`
4. Replaced all `db.` references with `this.db.`

## Verification Results

| Check | Result |
|-------|--------|
| No `.service.ts` imports `db` from `../db/client` | PASS |
| `TransactionsService` has `@Inject(DRIZZLE)` | PASS |
| `InsightsService` has `@Inject(DRIZZLE)` | PASS |
| `CategoriesService` has `@Inject(DRIZZLE)` | PASS |
| `AccountService` has `@Inject(DRIZZLE)` | PASS |
| `npm run build` exits 0 | PASS |

## Requirements Satisfied
- TST-01: All services use `@Inject(DRIZZLE)` instead of singleton import
