# Chi Expense — Complete Technical Specification v3.0

> **Version:** 3.0 · **Date:** April 12, 2026 · **Author:** Trí (Web Engineer, Cake Digital Bank)
> **Name inspiration:** Go Chi router (github.com/go-chi/chi) — lightweight, composable, idiomatic. The name "Chi" (支) also means "expenditure" in CJK.
> **Status:** Multi-user commercial product targeting App Store + Google Play

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [Design System — "Void" (Co-Star Inspired)](#2-design-system--void-co-star-inspired)
3. [Frontend — React Native + Expo SDK 55](#3-frontend--react-native--expo-sdk-55)
4. [Backend — NestJS 11 on Vercel](#4-backend--nestjs-11-on-vercel)
5. [Authentication — Better Auth + GitHub OAuth](#5-authentication--better-auth--github-oauth)
6. [Database — Turso + Drizzle ORM](#6-database--turso--drizzle-orm)
7. [AI Pipeline — LLM-Powered Expense Parsing](#7-ai-pipeline--llm-powered-expense-parsing)
8. [API Contract](#8-api-contract)
9. [Project Structure](#9-project-structure)
10. [App Store & Google Play Submission](#10-app-store--google-play-submission)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)
12. [Senior Dev Review — Issues, Gaps & Enhancements](#12-senior-dev-review--issues-gaps--enhancements)
13. [Appendix — Version Matrix](#13-appendix--version-matrix)

---

## 1. Product Definition

### 1.1 What This Is

**Chi Expense** is a zero-friction expense tracking app where users log spending in under 2 seconds via Vietnamese freetext, camera receipt OCR, or banking SMS paste. An LLM automatically extracts amount, merchant, and category. The UI is stark black-and-white minimalism inspired by Co-Star.

This is a **multi-user commercial product** targeting the Vietnamese market, distributed on both the Apple App Store and Google Play Store.

### 1.2 What Changed from v2 (Single-User Personal Tool)

| Aspect | v2 (Personal Tool) | v3 (Commercial Product) |
|---|---|---|
| Users | Single (Trí only) | Multi-user, public registration |
| Backend | Elysia (Bun) | NestJS 11 (Node.js) |
| Auth | GitHub OAuth only | GitHub OAuth (primary), expandable to Google/Apple |
| Distribution | Dev build / TestFlight | App Store + Google Play |
| Vercel Plan | Hobby (free, no commercial) | **Pro ($20/month)** — commercial use required |
| Database | Single-tenant Turso | Multi-tenant Turso with user isolation |
| Revenue model | None | Free (ad-free, data-private) → future premium |
| Legal | None | Privacy Policy, Terms of Service, Account Deletion |

### 1.3 Why NestJS Instead of Elysia

| Factor | Elysia | NestJS | Winner |
|---|---|---|---|
| Vercel support | Auto-detected, zero config | **Official Vercel framework page** with zero config | NestJS (officially listed) |
| Vercel runtime | Bun (Public Beta) | Node.js 20.x (**GA, stable**) | NestJS |
| Ecosystem maturity | 17.8K GitHub stars, ~413K npm/week | **77K+ GitHub stars**, millions npm/week | NestJS |
| Enterprise patterns | Minimal — routes + plugins | Full DI, modules, guards, interceptors, pipes | NestJS |
| Better Auth integration | Via `mount()` (direct) | Via `@thallesp/nestjs-better-auth` (module + DI) | Tie |
| Multi-user concerns | Manual middleware | Built-in guards, global pipes, exception filters | NestJS |
| tsconfig paths on Vercel | **Broken with Bun** (issue #1789) | Works with `@vercel/node` builder | NestJS |
| Cold start | Faster (Bun runtime) | Slower (~1-2s on Node.js, mitigated by Fluid Compute) | Elysia |
| Long-term stability | v1.4.x, Bun ecosystem still young | **v11.x, backed by NestJS Ltd**, HeroDevs NES support | NestJS |

**Decision:** NestJS provides the stability, ecosystem maturity, and enterprise patterns needed for a commercial multi-user product. The Vercel Bun runtime is still Public Beta with known issues. NestJS on Vercel Node.js is GA and battle-tested.

### 1.4 Target Users

- Vietnamese millennials and Gen Z who want to track daily spending without the UI clutter of Money Lover, MISA, or Rolly
- Developer-leaning users (GitHub OAuth as primary auth signals "built for people who value simplicity")
- Users who appreciate monochrome aesthetic and blunt, no-gamification UX

### 1.5 Competitive Differentiation from Rolly/MoneyBay

| Feature | Rolly | MoneyBay | Chi Expense |
|---|---|---|---|
| Design | Colorful, playful | Standard mobile | **Monochrome, Co-Star-like** |
| Tone | AI personalities that roast spending | Neutral | **Blunt, data-first, no gamification** |
| Auth | Email/password + social | Email/password | **GitHub OAuth (developer identity)** |
| Multi-expense | 1 per message | Unknown | **Batch detection** (future) |
| Price | 49k VND/month | Freemium | **Free (ad-free)** |
| Open source | No | No | **Considering** (portfolio leverage) |

### 1.6 Target Metrics

| Metric | Target |
|---|---|
| Input-to-confirm latency (text) | < 1.5s |
| Input-to-confirm latency (image) | < 4s perceived (streaming) |
| App cold start | < 2s |
| API cold start (NestJS on Vercel) | < 2s (Fluid Compute keeps warm) |
| Monthly cost (100 users) | < $25 (Vercel Pro $20 + OpenRouter ~$5) |
| App Store rating target | 4.5+ |

---

## 2. Design System — "Void" (Co-Star Inspired)

### 2.1 Design Philosophy

Named **"Void"** — inspired by Co-Star's design philosophy described by Lead Designer Andrew Lu: people come because existing spaces are "too loud, superficial and artificial." Co-Star provides "a space that is thoughtful, collective and deep."

The Co-Star DNA applied to expense tracking:

- **Text is the hero** — no flashy gradients, no illustrations. Numbers and words carry all meaning.
- **Monochrome palette** — pure black `#000000`, pure white `#FFFFFF`, grays for hierarchy. Only two accent colors exist: red for expenses, green for income.
- **Typography-first hierarchy** — font choice, weight, size, and spacing do ALL visual heavy lifting. Co-Star uses centered text alignment and minimal iconography.
- **Squiggly dividers** — Co-Star uses unique hand-drawn squiggly lines between sections. Chi Expense uses a 1px `#1F1F1F` line — cleaner, but same function.
- **Generous negative space** — Co-Star packs complex astrology data into simple sections with breathing room. Chi Expense does the same with financial data.
- **Blunt, direct tone** — Co-Star notifications are edgy and provocative. Chi Expense is blunt: no "Great job saving!" — just the numbers.

### 2.2 Color Tokens

```
// Core
--void-bg:          #000000    // Primary background
--void-surface:     #0A0A0A    // Card / elevated surface
--void-surface-2:   #141414    // Bottom sheet, modal backdrop
--void-border:      #1F1F1F    // Subtle dividers
--void-border-2:    #2A2A2A    // Active/focused borders

// Text
--void-text:        #FFFFFF    // Primary text
--void-text-2:      #A3A3A3    // Secondary (labels, categories, timestamps)
--void-text-3:      #525252    // Tertiary (hints, disabled, placeholders)

// Semantic (ONLY non-gray colors in the entire app)
--void-expense:     #DC2626    // Expense amounts
--void-income:      #22C55E    // Income amounts

// Interactive
--void-button-bg:   #FFFFFF    // Primary button background
--void-button-text: #000000    // Primary button text
```

### 2.3 Typography

| Role | Font | Weight | Size | Tracking | Platform |
|---|---|---|---|---|---|
| Amounts (primary) | JetBrains Mono | 400 | 16px | +0.05em | All |
| Amounts (hero) | JetBrains Mono | 300 | 32px | +0.03em | All |
| Section titles | Instrument Serif | 400 italic | 18px | normal | All |
| Labels/caps | System (SF Pro / Roboto) | 500 | 11px | +0.12em, uppercase | All |
| Body text | System (SF Pro / Roboto) | 400 | 14px | normal | All |
| Input fields | JetBrains Mono | 400 | 15px | normal | All |
| Buttons | JetBrains Mono | 500 | 13px | +0.08em, uppercase | All |

**Font loading:** Use `expo-font` to load JetBrains Mono (OFL license, free) and Instrument Serif (Google Fonts, OFL) at app startup. System fonts used for body text ensure native feel.

### 2.4 Spacing Scale (8px base)

```
--space-1:   4px     // Between label and value
--space-2:   8px     // Between elements in a group
--space-3:   12px    // Between groups
--space-4:   16px    // Section padding, card padding
--space-5:   24px    // Between sections
--space-6:   32px    // Major section breaks
--space-8:   48px    // Screen-level padding top
```

### 2.5 Core Screen Mockups

#### Sign In Screen

```
┌──────────────────────────────────┐
│                                  │
│                                  │
│                                  │
│         Chi Expense              │  ← Instrument Serif, 28px, italic, white
│    zero-friction tracking        │  ← System, 12px, #525252
│                                  │
│                                  │
│  ┌──────────────────────────┐    │
│  │  Continue with GitHub    │    │  ← JetBrains Mono, 13px
│  └──────────────────────────┘    │  ← White bg, black text, rounded 8px
│                                  │
│                                  │
│   Privacy Policy · Terms         │  ← #525252, 11px, underline
└──────────────────────────────────┘
   Background: pure #000000
```

#### Home Screen (Transaction Feed)

```
┌──────────────────────────────────┐
│  Chi Expense           ⚙        │  ← System, 14px · Settings icon
│──────────────────────────────────│
│                                  │
│          -8,450,000 ₫            │  ← JetBrains Mono, 32px, #DC2626
│         THÁNG 4, 2026            │  ← System, 11px, #525252, caps
│                                  │
│──────────────────────────────────│
│  HÔM NAY                        │  ← System, 11px, #525252, caps
│──────────────────────────────────│
│  GS25                   -85,000  │  ← White / Red, JetBrains Mono
│  Ăn uống · Ảnh · 14:32          │  ← #737373, System 11px
│──────────────────────────────────│
│  Xăng                   -50,000  │
│  Giao thông · Nhập · 09:15      │
│──────────────────────────────────│
│  HÔM QUA                        │
│──────────────────────────────────│
│  Grab                   -35,000  │
│  Giao thông · Nhập · 18:42      │
│──────────────────────────────────│
│                                  │
│                          ( + )   │  ← FAB: white "+" on #1F1F1F circle
│                                  │
│  Trang chủ    Báo cáo           │  ← Bottom tabs, text only, no icons
└──────────────────────────────────┘
```

#### Quick Add Bottom Sheet

```
┌──────────────────────────────────┐
│  ────── (pill, #2A2A2A, 32×4px)  │
│                                  │
│  Nhập     Chụp      Dán SMS     │  ← Active: white + underline
│  ────────────────────────────────│
│                                  │
│  ┌──────────────────────────┐    │
│  │ cà phê 35k...            │    │  ← JetBrains Mono, 15px, placeholder #525252
│  └──────────────────────────┘    │
│                                  │
│                        Gửi →    │  ← White text, right-aligned
└──────────────────────────────────┘
```

#### Confirm Card (AI Result)

```
┌──────────────────────────────────┐
│                                  │
│           -50,000 ₫              │  ← JetBrains Mono, 32px, #DC2626
│                                  │
│       Xăng · Giao thông         │  ← System, 14px, #A3A3A3
│       Hôm nay, 14:32            │  ← System, 12px, #525252
│                                  │
│  ┌──────────────────────────┐    │
│  │       XÁC NHẬN           │    │  ← White bg, black text, full width
│  └──────────────────────────┘    │
│                                  │
│          Sửa · Hủy              │  ← #525252, underline
└──────────────────────────────────┘
```

### 2.6 Motion & Haptics

| Interaction | Animation | Haptic |
|---|---|---|
| Bottom sheet open | Spring: damping 25, stiffness 300 | None |
| Confirm button press | Scale 0.97 → 1.0 (100ms ease-out) | `impactAsync(Medium)` |
| Transaction confirmed | New row slides in from top (200ms ease-out) | `notificationAsync(Success)` |
| Swipe to delete | Follow finger, snap at threshold | `impactAsync(Heavy)` at threshold |
| Loading states | Skeleton pulse (#0A0A0A ↔ #141414, 1.2s) | None |

### 2.7 Iconography

**Zero icons** for navigation. Text-only tabs with active state = white text + 2px bottom underline. Inactive = #525252. This is more extreme than Co-Star (which uses minimal icons) and creates a distinctive editorial feel.

Exception: The FAB uses a `+` character (JetBrains Mono, 24px, white) on a #1F1F1F circle (56px diameter).

---

## 3. Frontend — React Native + Expo SDK 55

### 3.1 Technology Versions (Verified April 12, 2026)

| Technology | Version | Source |
|---|---|---|
| Expo SDK | **55** (stable) | expo.dev/changelog |
| React Native | **0.83.2** | Included in SDK 55 |
| React | **19.2** | Included in SDK 55 |
| Architecture | **New Architecture ONLY** | Legacy removed. Cannot disable. |
| JS Engine | Hermes (default), Hermes v1 (opt-in) | SDK 55 |
| Router | Expo Router v7 | File-based, native tabs, `Stack.Protected` |
| Min iOS | 15.1+ | SDK 55 requirement |
| Min Android | API 24 (Android 7+) | SDK 55 requirement |

### 3.2 Dependencies

```json
{
  "dependencies": {
    "expo": "~55.0.0",
    "expo-router": "~4.0.0",
    "expo-camera": "~16.0.0",
    "expo-image-manipulator": "~13.0.0",
    "expo-haptics": "~14.0.0",
    "expo-font": "~13.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-web-browser": "~14.0.0",
    "expo-linking": "~7.0.0",
    "react-native-reanimated": "~4.1.0",
    "react-native-gesture-handler": "~2.28.0",
    "@react-native-voice/voice": "^3.2.0",
    "better-auth": "^1.6.0",
    "@better-auth/expo": "^1.6.2",
    "zustand": "^5.0.0",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### 3.3 Screen Architecture (Expo Router v7)

```
app/
├── _layout.tsx                  # Root: fonts, auth provider, theme
├── sign-in.tsx                  # GitHub OAuth sign-in
├── (app)/
│   ├── _layout.tsx              # Auth-guarded tab layout
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Native tabs (text-only, no icons)
│   │   ├── index.tsx            # Home — transaction feed
│   │   └── report.tsx           # Monthly report
│   └── add/
│       └── index.tsx            # Quick add (bottom sheet modal)
├── settings.tsx                 # Account, delete account, logout
└── privacy.tsx                  # Privacy policy (required for App Store)
```

**Auth protection with Expo Router v7 `Stack.Protected`:**

```tsx
// app/_layout.tsx
export default function RootLayout() {
  const { data: session } = useSession();
  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
```

### 3.4 Better Auth Expo Client Setup

```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL!,
  plugins: [
    expoClient({
      scheme: 'chi-expense',
      storagePrefix: 'chi-expense',
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signOut } = authClient;
```

### 3.5 Image Compression (Pre-upload)

```typescript
// lib/compress.ts
import * as ImageManipulator from 'expo-image-manipulator';

export async function compressForOCR(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return `data:image/jpeg;base64,${result.base64!}`;
}
```

### 3.6 Native STT (Vietnamese)

```typescript
import Voice from '@react-native-voice/voice';

Voice.onSpeechResults = (e) => {
  const transcript = e.value?.[0] ?? '';
  if (transcript) submitText(transcript, 'voice');
};

await Voice.start('vi-VN');
```

**Requires dev build** — not compatible with Expo Go. Use `npx expo run:ios` / `npx expo run:android`.

---

## 4. Backend — NestJS 11 on Vercel

### 4.1 Technology Versions (Verified April 12, 2026)

| Technology | Version | Source |
|---|---|---|
| NestJS | **11.1.18** | npm, published 7 days ago |
| @nestjs/cli | Latest | npm |
| Node.js runtime | **20.x** (Vercel default, GA) | vercel.com/docs |
| Vercel Framework | **Official NestJS support** | vercel.com/docs/frameworks/backend/nestjs |
| Fluid Compute | Enabled by default | GA since April 2025 |

### 4.2 NestJS on Vercel — How It Works

<Verified from vercel.com/docs/frameworks/backend/nestjs, updated October 28, 2025>

- Deploy with **zero configuration** — Vercel auto-detects NestJS
- The entire NestJS application becomes a **single Vercel Function**
- Uses **Fluid Compute** by default (active CPU billing, cold start prevention, optimized concurrency)
- All Vercel Functions limitations apply (250MB bundle size limit)
- Standard entry point: `src/main.ts` with `NestFactory.create(AppModule)`

### 4.3 vercel.json

```json
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

**CRITICAL:** Include `OPTIONS` method for CORS preflight requests from the mobile app. Without it, all cross-origin POST requests will fail.

### 4.4 main.ts (Vercel-compatible)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,  // Required for Better Auth
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.enableCors({
    origin: [
      'chi-expense://',
      'exp://',
      process.env.FRONTEND_URL || 'http://localhost:8081',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### 4.5 Vercel Pro Plan (Required for Commercial Use)

| Constraint | Hobby (Free) | Pro ($20/month) | Impact |
|---|---|---|---|
| Commercial use | **PROHIBITED** | ✅ Allowed | Must use Pro |
| Price | Free | $20/seat/month | Solo dev = $20/month |
| Included credit | None | $20/month usage credit | Covers most usage |
| Bandwidth | 100 GB | 1 TB | More than enough |
| Function invocations | 1M/month | 1M/month | Same |
| Active CPU | 4 hrs/month | Included in credit | LLM proxy routes may consume more |
| Function duration | 60s max | 300s max | Safer for OCR routes |
| Concurrent builds | 1 | 12 | Faster iterations |
| Build machines | Standard | Turbo (30 vCPU, 60GB RAM) | Faster builds |

### 4.6 Known NestJS + Vercel Issues

**Issue 1: Path aliases not resolving**

Multiple developers report `@/` path aliases failing on Vercel with `MODULE_NOT_FOUND`. Fix: Build to `dist/` locally and deploy the compiled JS, OR use the `tsconfig-paths` package.

**Recommended approach:** Build before deploy. Add to `package.json`:
```json
{
  "scripts": {
    "build": "nest build",
    "vercel-build": "nest build"
  }
}
```

Then use `dist/main.js` in `vercel.json` (not `src/main.ts`).

**Issue 2: Cold start latency**

NestJS cold starts on Vercel can be 1-3 seconds (DI container initialization, module imports). Fluid Compute's cold start prevention mitigates this for Pro plans. Additionally, a health check cron (e.g., UptimeRobot pinging `/api/health` every 5 minutes) keeps the function warm.

**Issue 3: Session/cookie handling in serverless**

NestJS sessions using `cookie-session` or `express-session` do NOT work reliably on Vercel because each invocation may be a different instance. Better Auth uses **stateless bearer tokens** for mobile (not cookies), which works perfectly in serverless.

---

## 5. Authentication — Better Auth + GitHub OAuth

### 5.1 Packages

| Package | Version | Purpose |
|---|---|---|
| `better-auth` | ^1.6.0 | Core auth framework |
| `@thallesp/nestjs-better-auth` | ^2.x | NestJS module with guards, decorators, DI hooks |
| `@better-auth/expo` | ^1.6.2 | Expo client plugin (SecureStore, deep links) |
| `expo-secure-store` | ~14.0.0 | Secure token storage on device |

### 5.2 Server Setup

```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { expo } from '@better-auth/expo';
import { bearer } from 'better-auth/plugins';
import { db } from '../db/client';

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
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    expo(),
    bearer(),
  ],
  account: {
    accountLinking: { enabled: true },  // Future: link Google/Apple accounts
  },
  user: {
    deleteUser: { enabled: true },  // REQUIRED by App Store
  },
});
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { TransactionsModule } from './transactions/transactions.module';
import { InsightsModule } from './insights/insights.module';
import { CategoriesModule } from './categories/categories.module';
import { InputModule } from './input/input.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    TransactionsModule,
    InsightsModule,
    CategoriesModule,
    InputModule,
  ],
})
export class AppModule {}
```

### 5.3 Using Auth in Controllers

```typescript
// src/transactions/transactions.controller.ts
import { Controller, Get, Post, Body, Query, Delete, Param, Patch } from '@nestjs/common';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@Controller('api/transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query('month') month: string) {
    return this.service.listByMonth(session.user.id, month);
  }

  @Post()
  async create(@Session() session: UserSession, @Body() dto: CreateTransactionDto) {
    return this.service.create(session.user.id, dto);
  }

  @Delete(':id')
  async delete(@Session() session: UserSession, @Param('id') id: string) {
    return this.service.delete(session.user.id, id);
  }
}
```

### 5.4 Multi-User Security Considerations

| Concern | Solution |
|---|---|
| User isolation | Every query filters by `userId`. No endpoint returns data without auth. |
| Rate limiting per user | Upstash Ratelimit with user ID as key (20 LLM calls/hour per user) |
| Account deletion | Better Auth `user.deleteUser.enabled: true`. Cascade delete all transactions. **Required by App Store.** |
| Data export | GDPR-style `GET /api/export` returns all user data as JSON. Good practice. |
| Demo credentials for App Review | Create a demo GitHub account for Apple reviewers. Include in App Store Connect notes. |

### 5.5 GitHub OAuth App Setup

1. Go to **github.com/settings/developers** → OAuth Apps → New OAuth App
2. App name: `Chi Expense`
3. Homepage URL: `https://chi-expense.vercel.app`
4. Callback URL: `https://chi-expense.vercel.app/api/auth/callback/github`
5. Copy Client ID → `GITHUB_CLIENT_ID` in Vercel env
6. Generate Secret → `GITHUB_CLIENT_SECRET` in Vercel env

---

## 6. Database — Turso + Drizzle ORM

### 6.1 Schema (Multi-User)

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Better Auth tables (auto-managed): user, session, account, verification

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),         // Better Auth user.id
  amount: integer('amount').notNull(),       // VND, negative=expense
  merchant: text('merchant').notNull(),
  category: text('category').notNull(),
  source: text('source').notNull(),          // 'text'|'voice'|'image'|'sms'
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  budget: integer('budget'),
  createdAt: text('created_at').notNull(),
});
```

### 6.2 Multi-Tenant Considerations

Turso free tier: 9GB storage, 500M rows read/month. With 100 users averaging 8 transactions/day, that's ~24K transactions/month, ~5MB data. Well within free tier.

**Scaling trigger:** If reaching 1000+ users, consider Turso's paid plan ($29/month) or migrate to Neon Postgres (serverless Postgres, free tier 0.5GB).

---

## 7. AI Pipeline — LLM-Powered Expense Parsing

### 7.1 Model Strategy

| Input | Model | Provider | Latency | Cost/Request |
|---|---|---|---|---|
| Text/Voice (Vietnamese) | Qwen3 8B | OpenRouter | ~0.5s | ~$0.0001 |
| Image OCR | GPT-4o-mini | OpenRouter | ~2s | ~$0.002 |
| SMS (structured) | Qwen3 8B | OpenRouter | ~0.5s | ~$0.0001 |

### 7.2 Cost Projection (Multi-User)

| Users | Transactions/Month | Text Cost | Image Cost (20%) | Total/Month |
|---|---|---|---|---|
| 10 | 2,400 | $0.24 | $0.96 | ~$1.20 |
| 100 | 24,000 | $2.40 | $9.60 | ~$12.00 |
| 1,000 | 240,000 | $24.00 | $96.00 | ~$120.00 |

At 1,000 users, LLM costs become significant. Mitigation: merchant lookup table skips LLM for known merchants (covers ~60% of transactions).

---

## 8. API Contract

### 8.1 Base URL

```
Production: https://chi-expense.vercel.app/api
```

### 8.2 Auth

All routes except `/api/auth/*` and `/api/health` require:
```
Authorization: Bearer <session_token>
```

### 8.3 Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/input/text` | Parse Vietnamese text → expense |
| POST | `/api/input/image` | OCR receipt image → expense |
| POST | `/api/transactions` | Create confirmed transaction |
| GET | `/api/transactions?month=2026-04` | List transactions |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/insights?month=2026-04` | Monthly summary |
| GET | `/api/categories` | List categories |
| GET | `/api/export?format=json` | Export all user data (GDPR) |
| DELETE | `/api/account` | Delete account + all data (App Store requirement) |
| GET | `/api/health` | Health check (public) |

---

## 9. Project Structure

### 9.1 Two Separate Repos

```
chi-expense-api/    → Vercel (NestJS)
chi-expense-app/    → EAS Build (Expo)
```

### 9.2 Backend Structure (NestJS)

```
chi-expense-api/
├── src/
│   ├── main.ts                    # Bootstrap, CORS, validation pipes
│   ├── app.module.ts              # Root module
│   ├── lib/
│   │   ├── auth.ts                # Better Auth instance
│   │   ├── openrouter.ts          # LLM client
│   │   ├── redis.ts               # Upstash Redis + Ratelimit
│   │   ├── prompts.ts             # LLM system prompts
│   │   └── merchant-table.ts      # Static merchant → category map
│   ├── db/
│   │   ├── client.ts              # Drizzle + Turso
│   │   ├── schema.ts              # Table definitions
│   │   └── migrations/
│   ├── input/
│   │   ├── input.module.ts
│   │   ├── input.controller.ts    # POST /api/input/text, /api/input/image
│   │   ├── input.service.ts       # LLM orchestration
│   │   └── dto/
│   ├── transactions/
│   │   ├── transactions.module.ts
│   │   ├── transactions.controller.ts
│   │   ├── transactions.service.ts
│   │   └── dto/
│   ├── insights/
│   │   ├── insights.module.ts
│   │   ├── insights.controller.ts
│   │   └── insights.service.ts
│   ├── categories/
│   │   └── ...
│   └── account/
│       ├── account.controller.ts  # DELETE /api/account, GET /api/export
│       └── account.service.ts
├── drizzle.config.ts
├── vercel.json
├── nest-cli.json
├── tsconfig.json
├── package.json
└── .env.example
```

### 9.3 Frontend Structure (Expo)

```
chi-expense-app/
├── app/
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   ├── privacy.tsx
│   ├── settings.tsx
│   └── (app)/
│       ├── _layout.tsx
│       └── (tabs)/
│           ├── _layout.tsx
│           ├── index.tsx
│           └── report.tsx
├── components/
├── lib/
│   ├── auth-client.ts
│   ├── api.ts
│   └── compress.ts
├── stores/
├── constants/design.ts
├── assets/fonts/
├── app.json
└── eas.json
```

---

## 10. App Store & Google Play Submission

### 10.1 Developer Account Costs

| Store | Cost | Type |
|---|---|---|
| Apple Developer Program | **$99 USD/year** (~2.5M VND) | Annual subscription |
| Google Play Developer | **$25 USD one-time** (~625K VND) | One-time registration |

### 10.2 EAS Build & Submit

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Build for Google Play
eas build --platform android --profile production

# Submit to App Store (goes to TestFlight first)
eas submit --platform ios

# Submit to Google Play (first upload must be manual)
eas submit --platform android
```

### 10.3 App Store Requirements Checklist

| Requirement | Status | Notes |
|---|---|---|
| Apple Developer Program ($99/yr) | ❗ Need to purchase | Required for App Store |
| Privacy Policy URL | ❗ Must create | Host at chi-expense.vercel.app/privacy |
| App Privacy Labels | ❗ Must declare | Data collected: name, email (via GitHub) |
| Account Deletion | ✅ Implemented | Better Auth `deleteUser: true` + cascade |
| Demo Credentials for Review | ❗ Need demo GitHub account | Or use "Sign in with Apple" (future) |
| AI Transparency Disclosure | ❗ Required since 2025 | Must disclose AI/LLM usage in-app and in submission |
| iOS 18+ SDK | ✅ Expo SDK 55 uses latest Xcode | Verify when building |
| 64-bit support | ✅ Default in Expo | Automatic |
| iPad support | ⚠️ Optional but recommended | Expo handles responsive layout |

### 10.4 Google Play Requirements Checklist

| Requirement | Status | Notes |
|---|---|---|
| Google Play Developer ($25 one-time) | ❗ Need to purchase | Required for Play Store |
| Privacy Policy | ❗ Same URL as iOS | Required |
| Content Rating | ❗ Must complete questionnaire | IARC rating system |
| Data Safety Section | ❗ Must declare data practices | Similar to Apple privacy labels |
| First upload MUST be manual | ❗ Important | EAS Submit won't work for first-ever upload |
| Target API level 36+ | ✅ Expo SDK 55 handles this | April 2026 requirement |
| AAB format (not APK) | ✅ Expo default | Google Play requires AAB |

### 10.5 App Store Rejection Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| "GitHub only" auth rejected | **Medium** — Apple prefers Sign in with Apple | Add Sign in with Apple as second option before submission |
| AI disclosure missing | **High** if omitted | Add clear AI disclosure in settings + app description |
| No account deletion | **Certain rejection** if missing | Better Auth `deleteUser` + cascade delete |
| Missing privacy policy | **Certain rejection** | Create and host before submission |
| Demo credentials issue | **Medium** | Create demo GitHub account, document in reviewer notes |

**CRITICAL: Apple strongly recommends (practically requires) Sign in with Apple** for any app offering third-party social login. You may need to add Apple Sign-In alongside GitHub OAuth to avoid rejection. Better Auth supports Apple as a social provider.

---

## 11. Deployment & Infrastructure

### 11.1 Monthly Cost Projection

| Service | Free Tier | Pro/Paid | 100 Users | 1000 Users |
|---|---|---|---|---|
| Vercel Pro | — | **$20/month** | $20 | $20 + overages |
| Turso | 9GB free | $29/month if exceeded | Free | $29 |
| Upstash Redis | 10K cmd/day free | $0 | Free | Free |
| OpenRouter | Pay-per-use | — | ~$12 | ~$120 |
| Apple Developer | — | $99/year ($8.25/mo) | $8.25 | $8.25 |
| Google Play | — | $25 one-time | $0 | $0 |
| EAS Build | 30 builds/mo free | $0 | Free | Free |
| Sentry | 5K errors free | $0 | Free | Free |
| **Total** | | | **~$40/month** | **~$177/month** |

### 11.2 Environment Variables (Backend)

```bash
# NestJS
PORT=3000
NODE_ENV=production

# Better Auth
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://chi-expense.vercel.app

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Turso
TURSO_CONNECTION_URL=libsql://chi-expense.turso.io
TURSO_AUTH_TOKEN=

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Frontend URL (CORS)
FRONTEND_URL=https://chi-expense.vercel.app

# Sentry (optional)
SENTRY_DSN=
```

---

## 12. Senior Dev Review — Issues, Gaps & Enhancements

### 12.1 CRITICAL ISSUES

#### C1: Apple Will Likely Require Sign in with Apple

**Problem:** Apple's App Store Review Guidelines (§4.8) state that apps offering third-party social login MUST also offer Sign in with Apple. GitHub OAuth alone will likely trigger rejection.

**Fix:** Add `apple` to Better Auth social providers before App Store submission. Better Auth supports Apple natively. Cost: $0 (included in Apple Developer Program). This is your **#1 rejection risk**.

#### C2: NestJS ESM/CJS Conflicts with Better Auth

**Problem:** Better Auth ships as **ESM**. NestJS uses **CJS** by default. Multiple developers report import errors when integrating. The community library `@thallesp/nestjs-better-auth` handles this, but it's community-maintained, not official.

**Fix:** Use `@thallesp/nestjs-better-auth` v2.x which handles ESM/CJS bridging. Pin the version. Monitor the repo for breaking changes. If it breaks, the fallback is to manually mount Better Auth via a NestJS middleware (documented in Better Auth NestJS integration page).

#### C3: NestJS Cold Start on Vercel Can Exceed 2s

**Problem:** NestJS has heavier bootstrap than Elysia due to DI container, module scanning, and metadata resolution. First cold start on Vercel can take 2-4 seconds.

**Fix:**
1. Enable Fluid Compute cold start prevention (default on Pro)
2. Set up a health check cron (UptimeRobot, free) pinging `/api/health` every 5 min
3. Minimize module imports — lazy-load heavy modules
4. Vercel Pro function duration is 300s max (vs 60s Hobby), giving more headroom

#### C4: `dist/` Must Be Committed or Built on Vercel

**Problem:** Vercel's `@vercel/node` builder expects compiled JS. If you point `builds.src` to `src/main.ts`, Vercel compiles with its own TypeScript compiler which may not understand NestJS decorators properly.

**Fix:** Use `vercel-build` script to run `nest build` first. Configure vercel.json to use `dist/main.js`. Add `dist/` to `.gitignore` (Vercel runs the build script during deployment).

```json
// package.json
{
  "scripts": {
    "build": "nest build",
    "vercel-build": "npm run build"
  }
}
```

### 12.2 IMPORTANT GAPS

#### G1: No Offline Support

**Problem:** Every transaction requires network (LLM + Turso). Users in subway/elevator can't log expenses.

**Enhancement:** Queue transactions in `expo-sqlite` with `synced: false`, sync when online. **Priority: Post-launch v1.1.**

#### G2: No Rate Limiting on LLM Routes

**Problem:** Without rate limiting, a user could spam image OCR and rack up OpenRouter costs.

**Fix:** Upstash Ratelimit — 20 LLM calls/hour per user, 5 image calls/hour per user. Implement as NestJS Guard.

#### G3: No Push Notifications

**Problem:** No daily spending summary, no budget alerts.

**Enhancement:** Add `expo-notifications` + a daily cron (via Vercel Cron) that sends "Hôm nay bạn chi -185k" at 9pm. **Priority: v1.2.**

#### G4: No Subscription/Monetization Layer

**Problem:** App is free but costs $40+/month to run. No revenue path.

**Enhancement:** Consider a "Chi Pro" tier ($29k VND/month) with: unlimited image OCR, monthly reports PDF export, custom categories. Use RevenueCat for in-app subscriptions (handles both App Store + Google Play). **Priority: v2.0.**

#### G5: No Analytics/Observability

**Problem:** No visibility into user behavior, feature usage, crash rates.

**Enhancement:** Add PostHog (free self-host or 1M events/month free cloud) for product analytics. Add Sentry for error tracking. **Priority: Launch-critical.**

### 12.3 ENHANCEMENTS

| Enhancement | Priority | Effort | Impact |
|---|---|---|---|
| Sign in with Apple | **P0 (blocker)** | Medium | Required for App Store |
| Rate limiting per user | P0 | Low | Prevents cost explosion |
| Privacy Policy page | P0 | Low | Required for both stores |
| Account deletion flow | P0 | Low | Required by App Store |
| AI usage disclosure | P0 | Low | Required since 2025 |
| Offline queue | P1 | Medium | UX improvement |
| Sentry error tracking | P1 | Low | Observability |
| Push notifications | P2 | Medium | Engagement |
| Data export (GDPR) | P2 | Low | Trust/compliance |
| RevenueCat subscriptions | P3 | High | Revenue |
| Widgets (iOS/Android) | P3 | Medium | Engagement |
| Multi-currency | P3 | Medium | Travel users |

---

## 13. Appendix — Version Matrix

### 13.1 All Versions (Verified April 12, 2026)

| Package | Version | Verified |
|---|---|---|
| @nestjs/core | **11.1.18** | npm, 7 days ago |
| @nestjs/common | 11.1.18 | npm |
| @nestjs/platform-express | 11.1.18 | npm |
| better-auth | ^1.6.0 | better-auth.com |
| @thallesp/nestjs-better-auth | ^2.x | npm |
| @better-auth/expo | 1.6.2 | npm, ~15 hours ago |
| drizzle-orm | ^0.40.0 | npm |
| @libsql/client | ^0.14.0 | npm |
| @upstash/redis | ^1.34.0 | npm |
| @upstash/ratelimit | ^2.0.0 | npm |
| openai | ^4.75.0 | npm (OpenRouter compat) |
| expo | ~55.0.0 | expo.dev/changelog |
| react-native | 0.83.2 | SDK 55 |
| react | 19.2 | SDK 55 |
| expo-router | ~4.0.0 | SDK 55 |
| react-native-reanimated | ~4.1.0 | SDK 55 |
| react-native-gesture-handler | ~2.28.0 | SDK 55 |
| @react-native-voice/voice | ^3.2.0 | npm |
| @better-auth/expo | 1.6.2 | npm |
| zustand | ^5.0.0 | npm |
| nativewind | ^4.0.0 | npm |
| nanoid | ^5.0.0 | npm |
| date-fns | ^4.0.0 | npm |

### 13.2 Infrastructure

| Service | Plan | Monthly Cost |
|---|---|---|
| Vercel | **Pro** ($20/seat) | $20 |
| Turso | Free (9GB) | $0 |
| Upstash Redis | Free (10K/day) | $0 |
| OpenRouter | Pay-per-use | ~$1-12 |
| Apple Developer | Annual ($99/yr) | $8.25 |
| Google Play | One-time ($25) | $0 |
| EAS Build | Free (30/mo) | $0 |
| Sentry | Free (5K/mo) | $0 |
| PostHog | Free (1M events/mo) | $0 |

### 13.3 Store Submission Costs

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | $99 USD | Annual |
| Google Play Developer | $25 USD | One-time |
| Apple App Review | Free | Per submission |
| Google Play Review | Free | Per submission |
| EAS Build (free tier) | Free | 30 iOS + 30 Android/month |
| EAS Submit | Free | Unlimited |

---

> **End of specification.** This document is designed to be handed to an AI coding agent (Claude Code, Cursor) for implementation. Every technology version has been verified against npm, official documentation, and GitHub as of April 12, 2026.
>
> **Next steps:**
> 1. Purchase Apple Developer Program ($99)
> 2. Register Google Play Developer ($25)
> 3. Upgrade Vercel to Pro ($20/month)
> 4. Create GitHub OAuth App
> 5. Scaffold NestJS backend with `nest new chi-expense-api`
> 6. Scaffold Expo app with `npx create-expo-app chi-expense-app`
> 7. Implement auth flow end-to-end first (most risk)
> 8. Build text input → LLM → confirm flow second
> 9. Add Sign in with Apple before App Store submission
