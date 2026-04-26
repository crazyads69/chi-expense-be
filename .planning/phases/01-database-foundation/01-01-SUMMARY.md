# Plan 01-01: Schema Fixes — Summary

**Executed:** 2026-04-26
**Status:** Complete

## Changes Made

### Task 1: Schema index + timestamp comments (`src/db/schema.ts`)
- Added `idx_transactions_category` index on `transactions.category` (DB-03)
- Added timestamp inconsistency comments at `transactions.createdAt` (line 108) and `categories.createdAt` (line 127), referencing D-04 deferral to v1.1

### Task 2: UNIQUE constraint fix (`src/categories/categories.service.ts`)
- Replaced `try/catch` error string matching with `onConflictDoNothing()` (DB-04 / D-08)
- Replaced recursive `this.list(userId)` with direct re-query using `db.select()` (D-09)
- Preserved legacy `id: cat.slug` mapping in both return paths

## Verification Results

| Check | Result |
|-------|--------|
| `idx_transactions_category` in schema.ts | PASS |
| 2 timestamp comments with D-04 reference | PASS |
| `onConflictDoNothing()` in categories.service.ts | PASS |
| No `UNIQUE constraint failed` string matching | PASS |
| No recursive `this.list(userId)` | PASS |
| No `try {` in the lazy init path | PASS |
| `npm run build` exits 0 | PASS |

## Requirements Satisfied
- DB-03: Missing index added
- DB-04: UNIQUE constraint handling fixed
