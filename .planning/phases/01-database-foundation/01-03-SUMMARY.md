# Plan 01-03: Migrations & CI — Summary

**Executed:** 2026-04-26
**Status:** Complete

## Changes Made

### Task 1: Initial migration generation
- Ran `npx drizzle-kit generate --name=init`
- Generated `drizzle/0000_init.sql` — 6 CREATE TABLE statements with all indices including `idx_transactions_category`
- Generated `drizzle/meta/_journal.json` — migration version manifest
- Generated `drizzle/meta/0000_snapshot.json` — schema snapshot for future diffs

### Task 2: Auto-migration on startup (`src/main.ts`)
- Added imports for `db` from `./db/client` and `migrate` from `drizzle-orm/libsql/migrator`
- Added migration code in `bootstrap()` before `NestFactory.create()` (D-12)
- Migration failures exit process with code 1 for fast failure visibility
- Uses `console.log`/`console.error` since NestJS logger isn't available at migration time

### Task 3: Manual migration + CI (`package.json`, `.github/workflows/db-check.yml`)
- Added `"db:migrate": "drizzle-kit migrate"` script to `package.json` (D-13)
- Created `.github/workflows/db-check.yml` with `drizzle-kit check` on push/PR (D-03)
- CI workflow uses Node 20, `npm ci`, runs on ubuntu-latest

## Verification Results

| Check | Result |
|-------|--------|
| `drizzle/0000_init.sql` exists with 6 CREATE TABLEs | PASS |
| `drizzle/meta/_journal.json` exists | PASS |
| `idx_transactions_category` in migration SQL | PASS |
| `idx_transactions_user_createdAt` in migration SQL | PASS |
| `migrate(db,` call in main.ts | PASS |
| `migrationsFolder: './drizzle'` in main.ts | PASS |
| `process.exit(1)` on migration failure | PASS |
| `"db:migrate": "drizzle-kit migrate"` in package.json | PASS |
| `.github/workflows/db-check.yml` exists | PASS |
| `drizzle-kit check` in CI workflow | PASS |
| Node 20 in CI workflow | PASS |
| `npm run build` exits 0 | PASS |

## Requirements Satisfied
- DB-01: Version-controlled migrations with CI drift check
