# Plan 04-01: Core Database Service Unit Tests — Summary

**Executed:** 2026-04-26
**Status:** Complete

## Changes Made

### Task 1: CategoriesService unit tests (`src/categories/categories.service.spec.ts`)
- Tests lazy initialization of 8 default categories for new users
- Verifies no duplicate categories on second call
- Tests returning existing categories without creating defaults

### Task 2: TransactionsService unit tests (`src/transactions/transactions.service.spec.ts`)
- Tests listByMonth with filtering and ordering
- Tests create with amount negation
- Tests update and delete with NotFoundException paths
- Tests invalid month format BadRequestException

### Task 3: AccountService unit tests (`src/account/account.service.spec.ts`)
- Tests deleteAccount cascade deletion across all 5 tables
- Tests exportData returns transactions and categories
- Tests empty data for new user

## Infrastructure Fixes
- Updated `test/helpers/setup.ts` to apply `drizzle/0000_init.sql` migration to in-memory SQLite
- Added `transformIgnorePatterns` to `package.json` jest config for `nanoid` ESM
- Mocked `testDb.transaction` for better-sqlite3 async compatibility

## Verification Results

| Check | Result |
|-------|--------|
| `src/categories/categories.service.spec.ts` passes | PASS |
| `src/transactions/transactions.service.spec.ts` passes | PASS |
| `src/account/account.service.spec.ts` passes | PASS |
| `npm test` (all suites) passes | PASS |

## Requirements Satisfied
- QAL-01: Unit tests for CategoriesService, TransactionsService, AccountService
