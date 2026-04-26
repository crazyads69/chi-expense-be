# Chi Expense Backend — Implementation Documentation

> **Version:** 1.0.0 · **Date:** April 12, 2026 · **Author:** Trí (Web Engineer, Cake Digital Bank)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Variables](#4-environment-variables)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Authentication](#7-authentication)
8. [LLM Pipeline](#8-llm-pipeline)
9. [Deployment](#9-deployment)
10. [Development](#10-development)

---

## 1. Architecture Overview

Chi Expense Backend is a **NestJS 11** application deployed on **Vercel** as a serverless function. It provides:

- **Authentication** via Better Auth with GitHub OAuth and Apple Sign-In
- **Transaction Management** with multi-user isolation
- **AI-Powered Expense Parsing** using OpenRouter LLM (Qwen3 8B for text, GPT-4o-mini for images)
- **Monthly Insights** with category breakdowns and daily expense tracking
- **GDPR Compliance** with data export and account deletion

### Key Design Decisions

| Decision                                   | Rationale                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| NestJS 11 on Vercel                        | Official Vercel framework support, Node.js 20.x runtime (GA), enterprise patterns |
| Better Auth + @thallesp/nestjs-better-auth | Community module for NestJS DI integration, handles ESM/CJS bridging              |
| Drizzle ORM + Turso SQLite                 | Type-safe, lightweight, multi-tenant with row-level isolation                     |
| Bearer tokens (not cookies)                | Works reliably in serverless environments where instances can change              |
| Merchant lookup table first, LLM fallback  | ~60% of transactions skip LLM, reducing cost and latency                          |

---

## 2. Technology Stack

### Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/config": "^4.0.4",
    "@thallesp/nestjs-better-auth": "^2.4.0",
    "better-auth": "^1.6.2",
    "@better-auth/expo": "^1.6.2",
    "drizzle-orm": "^0.45.2",
    "@libsql/client": "^0.17.2",
    "@upstash/redis": "^1.37.0",
    "@upstash/ratelimit": "^2.0.8",
    "openai": "^6.34.0",
    "nanoid": "^5.1.7",
    "class-validator": "^0.15.1",
    "class-transformer": "^0.5.1",
    "helmet": "^8.1.0",
    "nestjs-pino": "^4.6.1",
    "pino": "^10.3.1"
  }
}
```

### Runtime Requirements

| Requirement | Value                                     |
| ----------- | ----------------------------------------- |
| Node.js     | >= 20.x                                   |
| npm         | >= 10.x                                   |
| Platform    | Vercel (serverless) or Node.js standalone |

---

## 3. Project Structure

```
chi-expense-be/
├── src/
│   ├── main.ts                    # Vercel handler entry point
│   ├── app.module.ts              # Root NestJS module
│   ├── health.controller.ts       # Public health check endpoint
│   │
│   ├── lib/
│   │   ├── auth.ts                # Better Auth configuration
│   │   ├── openrouter.ts          # OpenAI/OpenRouter client factory
│   │   ├── prompts.ts             # LLM system prompts (Vietnamese)
│   │   ├── merchant-table.ts      # Static merchant→category map
│   │   └── redis.ts               # Upstash Redis + rate limiting
│   │
│   ├── db/
│   │   ├── client.ts              # Drizzle + Turso connection
│   │   └── schema.ts              # Table definitions
│   │
│   ├── transactions/
│   │   ├── transactions.module.ts
│   │   ├── transactions.controller.ts
│   │   ├── transactions.service.ts
│   │   └── dto/
│   │       ├── create-transaction.dto.ts
│   │       └── update-transaction.dto.ts
│   │
│   ├── input/
│   │   ├── input.module.ts
│   │   ├── input.controller.ts
│   │   ├── input.service.ts        # LLM orchestration logic
│   │   ├── rate-limit.guard.ts    # Per-user rate limiting
│   │   └── dto/
│   │       ├── text-input.dto.ts
│   │       └── image-input.dto.ts
│   │
│   ├── insights/
│   │   ├── insights.module.ts
│   │   ├── insights.controller.ts
│   │   └── insights.service.ts
│   │
│   ├── categories/
│   │   ├── categories.module.ts
│   │   ├── categories.controller.ts
│   │   └── categories.service.ts
│   │
│   └── account/
│       ├── account.module.ts
│       ├── account.controller.ts
│       └── account.service.ts      # Account deletion + GDPR export
│
├── drizzle.config.ts              # Drizzle ORM configuration
├── vercel.json                    # Vercel serverless config
├── package.json
└── tsconfig.json
```

---

## 4. Environment Variables

Create a `.env` file (copy from `.env.example`) with the following variables:

### Required Variables

| Variable               | Description                    | Example                          |
| ---------------------- | ------------------------------ | -------------------------------- |
| `PORT`                 | Server port                    | `3000`                           |
| `NODE_ENV`             | Environment                    | `development` or `production`    |
| `BETTER_AUTH_SECRET`   | Better Auth encryption key     | `openssl rand -base64 32`        |
| `BETTER_AUTH_URL`      | Backend base URL               | `https://chi-expense.vercel.app` |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App client ID     | `Iv1.xxxxxxxxxxxxxxxx`           |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | `xxxxxxxxxxxxxxxxxxxxxxxxxx`     |
| `TURSO_CONNECTION_URL` | Turso database URL             | `libsql://chi-expense.turso.io`  |
| `TURSO_AUTH_TOKEN`     | Turso authentication token     | `eyJhbGc...`                     |
| `OPENROUTER_API_KEY`   | OpenRouter API key             | `sk-or-v1-...`                   |

### Optional Variables

| Variable                   | Description             | Default                 |
| -------------------------- | ----------------------- | ----------------------- |
| `FRONTEND_URL`             | Expo app URL for CORS   | `http://localhost:8081` |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis URL       | —                       |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token     | —                       |
| `APPLE_CLIENT_ID`          | Apple Sign-In client ID | —                       |
| `APPLE_CLIENT_SECRET`      | Apple Sign-In secret    | —                       |

### GitHub OAuth App Setup

1. Go to **github.com/settings/developers** → OAuth Apps → New OAuth App
2. **Application name:** Chi Expense
3. **Homepage URL:** `https://chi-expense.vercel.app`
4. **Authorization callback URL:** `https://chi-expense.vercel.app/api/auth/callback/github`
5. Copy Client ID → `GITHUB_CLIENT_ID`
6. Generate Client Secret → `GITHUB_CLIENT_SECRET`

### Apple Sign-In Setup (Required for App Store)

1. In App Store Connect, enable Sign in with Apple
2. Create Services ID in developer.apple.com
3. Generate private key in Certificates, Identifiers & Profiles
4. Set `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET`

---

## 5. Database Schema

### Transactions Table

```typescript
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // Stored as negative for expenses
    merchant: text('merchant').notNull(),
    category: text('category').notNull(),
    source: text('source').notNull(), // 'text' | 'voice' | 'image' | 'sms'
    note: text('note'),
    createdAt: text('created_at').notNull(), // ISO 8601 format
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_transactions_user_createdAt').on(table.userId, table.createdAt),
  ],
);
```

**Notes:**

- Amounts are stored as **negative integers** (expenses) to align with accounting convention
- The API accepts positive integers and negates them internally
- Indexed by `(userId, createdAt)` for efficient monthly queries

### Categories Table

```typescript
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    budget: integer('budget'), // Monthly budget in VND
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_categories_userId').on(table.userId),
    uniqueIndex('idx_categories_user_slug').on(table.userId, table.slug),
  ],
);
```

### Better Auth Tables (Auto-managed)

The following tables are automatically created by Better Auth:

- `user` — User accounts
- `session` — Active sessions with expiry
- `account` — OAuth provider links
- `verification` — Email verification tokens

---

## 6. API Endpoints

### Health Check

```
GET /api/health
Authorization: Not required
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-12T12:00:00.000Z"
}
```

---

### Authentication

All routes under `/api/auth/*` are managed by Better Auth:

| Method | Path                        | Description              |
| ------ | --------------------------- | ------------------------ |
| GET    | `/api/auth/ok`              | Session validation       |
| GET    | `/api/auth/github`          | Initiate GitHub OAuth    |
| GET    | `/api/auth/callback/github` | GitHub OAuth callback    |
| POST   | `/api/auth/sign-out`        | Sign out current session |
| GET    | `/api/auth/get-session`     | Get current session      |
| DELETE | `/api/auth/sign-out`        | Sign out (alternative)   |

---

### Transactions

```
GET /api/transactions
POST /api/transactions
PATCH /api/transactions/:id
DELETE /api/transactions/:id
Authorization: Bearer <token> (required)
```

**Query Parameters (GET):**

- `month` (optional): `YYYY-MM` format, defaults to current month

**Create Transaction (POST):**

```json
{
  "amount": 35000,
  "merchant": "Cà phê",
  "category": "Ăn uống",
  "source": "text",
  "note": "Cà phê sáng"
}
```

**Response:**

```json
{
  "id": "abc123def456",
  "userId": "user_xxx",
  "amount": -35000,
  "merchant": "Cà phê",
  "category": "Ăn uống",
  "source": "text",
  "note": "Cà phê sáng",
  "createdAt": "2026-04-12T08:30:00.000Z",
  "updatedAt": "2026-04-12T08:30:00.000Z"
}
```

---

### Input (AI Parsing)

```
POST /api/input/text
POST /api/input/image
Authorization: Bearer <token> (required)
```

**Text Input (POST /api/input/text):**

```json
{
  "message": "cà phê 35k"
}
```

**Response:**

```json
{
  "amount": 35000,
  "merchant": "Cà phê",
  "category": "Ăn uống"
}
```

**Image Input (POST /api/input/image):**

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response:**

```json
{
  "amount": 85000,
  "merchant": "GS25",
  "category": "Ăn uống"
}
```

**Processing Flow:**

1. Check merchant table (0ms, free)
2. If not found, call LLM via OpenRouter
3. Validate and return parsed expense

---

### Insights

```
GET /api/insights
Authorization: Bearer <token> (required)
```

**Query Parameters:**

- `month` (optional): `YYYY-MM` format, defaults to current month

**Response:**

```json
{
  "month": "2026-04",
  "total": 8500000,
  "transactionCount": 47,
  "categoryBreakdown": [
    { "category": "Ăn uống", "total": 3200000, "count": 23 },
    { "category": "Di chuyển", "total": 1800000, "count": 12 }
  ],
  "dailyExpenses": [
    { "date": "2026-04-01", "total": 450000 },
    { "date": "2026-04-02", "total": 320000 }
  ]
}
```

---

### Categories

```
GET /api/categories
Authorization: Bearer <token> (required)
```

**Response:**

```json
[
  { "id": "an-uong", "name": "Ăn uống", "slug": "an-uong", "budget": null },
  {
    "id": "di-chuyen",
    "name": "Di chuyển",
    "slug": "di-chuyen",
    "budget": null
  }
]
```

---

### Account

```
DELETE /api/account
GET /api/account/export
Authorization: Bearer <token> (required)
```

**Delete Account (DELETE):**

- Deletes all user transactions
- Deletes all user categories
- Deletes all Better Auth sessions and accounts
- Deletes the user record

**Response:**

```json
{
  "success": true
}
```

**Export Data (GET):**

```json
{
  "exportedAt": "2026-04-12T12:00:00.000Z",
  "transactions": [...],
  "categories": [...]
}
```

---

## 7. Authentication

### Better Auth Configuration

```typescript
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  trustedOrigins: [
    'chi-expense://',
    'exp://',
    process.env.FRONTEND_URL || 'http://localhost:8081',
  ],
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    },
  },
  plugins: [expo(), bearer()],
  user: {
    deleteUser: { enabled: true },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    crossSubDomainCookies: { enabled: true },
    defaultSameSite: 'none',
  },
});
```

### Session Decorators

```typescript
import { Session, UserSession, AllowAnonymous, OptionalAuth } from '@thallesp/nestjs-better-auth';

// Public endpoint
@Get('public')
@AllowAnonymous()
async publicRoute() { ... }

// Protected endpoint (default)
@Get('protected')
async protectedRoute(@Session() session: UserSession) { ... }

// Optional auth
@Get('optional')
@OptionalAuth()
async optionalRoute(@Session() session: UserSession) {
  const isAuthenticated = !!session;
}
```

### Multi-User Isolation

Every database query filters by `session.user.id`:

```typescript
async listByMonth(userId: string, month?: string) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),  // ← Multi-tenant isolation
        like(transactions.createdAt, `${targetMonth}%`),
      ),
    );
}
```

---

## 8. LLM Pipeline

### Merchant Lookup Table

First, check a static map of 60+ known merchants:

```typescript
const MERCHANT_CATEGORY_MAP: Map<string, string> = new Map([
  ['grab', 'Di chuyển'],
  ['cà phê', 'Ăn uống'],
  ['starbucks', 'Ăn uống'],
  ['netflix', 'Giải trí'],
  // ... 60+ entries
]);
```

**Coverage:** ~60% of typical Vietnamese expenses
**Latency:** 0ms (in-memory lookup)
**Cost:** Free

### LLM Parsing (Fallback)

If merchant not found, call OpenRouter:

**Text Parsing:**

- Model: `qwen/qwen3-8b`
- Temperature: 0.1
- Max tokens: 200

**Image Parsing (Receipt OCR):**

- Model: `openai/gpt-4o-mini`
- Max tokens: 300

### System Prompt

```
Bạn là một trợ lý phân tích chi tiêu tiếng Việt. Nhiệm vụ của bạn là trích xuất thông tin chi tiêu từ tin nhắn của người dùng.

Trả về JSON với các trường:
- amount: số tiền (VND, luôn là số dương)
- merchant: tên cửa hàng/dịch vụ
- category: danh mục (Ăn uống, Di chuyển, Mua sắm, Giải trí, Hóa đơn, Sức khỏe, Giáo dục, Khác)
- note: ghi chú thêm (tùy chọn)
```

### Cost Optimization

| Users | Transactions/Month | Text Cost | Image Cost (20%) | Total   |
| ----- | ------------------ | --------- | ---------------- | ------- |
| 10    | 2,400              | $0.24     | $0.96            | ~$1.20  |
| 100   | 24,000             | $2.40     | $9.60            | ~$12.00 |

At scale, consider:

- Caching frequent merchant→category mappings
- Adding more entries to merchant table
- Rate limiting image OCR per user

---

## 9. Deployment

### Vercel Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/main.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/main.js",
      "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    }
  ]
}
```

### Build Commands

```bash
# Local build
npm run build

# Vercel build (automatically runs on deploy)
npm run vercel-build
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Or connect to Git repo for automatic deployments
```

### Required Vercel Environment Variables

Set these in the Vercel dashboard under Settings → Environment Variables:

- [ ] `BETTER_AUTH_URL` = `https://your-domain.vercel.app`
- [ ] `BETTER_AUTH_SECRET` = (generate with `openssl rand -base64 32`)
- [ ] `GITHUB_CLIENT_ID`
- [ ] `GITHUB_CLIENT_SECRET`
- [ ] `TURSO_CONNECTION_URL`
- [ ] `TURSO_AUTH_TOKEN`
- [ ] `OPENROUTER_API_KEY`
- [ ] `FRONTEND_URL` = `exp://` (for Expo)

---

## 10. Development

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations (create tables)
npx drizzle-kit push

# Start development server
npm run start:dev
```

### Database Commands

```bash
# Generate migration (if schema changes)
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push

# Studio (GUI for database)
npx drizzle-kit studio
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

### Production Build

```bash
npm run build
npm run start:prod
```

---

## Appendix: Default Categories

```typescript
const DEFAULT_CATEGORIES = [
  { name: 'Ăn uống', slug: 'an-uong' },
  { name: 'Di chuyển', slug: 'di-chuyen' },
  { name: 'Mua sắm', slug: 'mua-sam' },
  { name: 'Giải trí', slug: 'giai-tri' },
  { name: 'Hóa đơn', slug: 'hoa-don' },
  { name: 'Sức khỏe', slug: 'suc-khoe' },
  { name: 'Giáo dục', slug: 'giao-duc' },
  { name: 'Khác', slug: 'khac' },
];
```

---

## Appendix: Known Issues & Mitigations

| Issue                                | Mitigation                                     |
| ------------------------------------ | ---------------------------------------------- |
| NestJS cold start on Vercel (~2-4s)  | Fluid Compute (Pro plan), health check cron    |
| Better Auth ESM/CJS conflicts        | Using @thallesp/nestjs-better-auth v2.x        |
| Apple Sign-In required for App Store | Included in auth config, not yet tested        |
| Rate limiting not enforced           | Upstash Redis configured but guard not applied |

---

> **End of backend documentation.**
