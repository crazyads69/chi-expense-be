# React Native Expo Integration Guide

A complete integration guide for connecting your React Native Expo app to the Chi Expense backend API.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Authentication with Better Auth](#authentication-with-better-auth)
- [API Client Setup](#api-client-setup)
- [API Reference for Mobile](#api-reference-for-mobile)
  - [Health Check](#health-check)
  - [Authentication Flows](#authentication-flows)
  - [Categories](#categories)
  - [Transactions](#transactions)
  - [AI Input Parsing](#ai-input-parsing)
  - [Insights](#insights)
  - [Account Management](#account-management)
- [React Native Code Examples](#react-native-code-examples)
  - [Auth Hook](#auth-hook)
  - [API Client with Fetch](#api-client-with-fetch)
  - [Expense Input Screen](#expense-input-screen)
  - [Transaction List Screen](#transaction-list-screen)
- [Image Handling](#image-handling)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers everything you need to integrate the Chi Expense backend into a React Native Expo application. The backend provides:

- **OAuth Authentication** (GitHub + Apple Sign-In) via Better Auth
- **Bearer token session management** compatible with mobile apps
- **AI expense parsing** from text and receipt images
- **Full CRUD** for transactions with pagination
- **Monthly insights** and spending analytics
- **App Store compliant** account deletion (GDPR export)

**Base URL Structure:**
```
Production:  https://your-app.vercel.app/api/v1/
Development: http://localhost:3000/api/v1/
```

All authenticated endpoints require an `Authorization: Bearer <token>` header.

---

## Prerequisites

- Expo SDK 50+ with `expo-router`
- Backend deployed and environment variables configured (see [README](../README.md))
- GitHub OAuth app (and optionally Apple Developer account for Sign in with Apple)

---

## Project Setup

### 1. Install Dependencies

```bash
npx create-expo-app chi-expense-app
cd chi-expense-app

# Core dependencies
npm install @better-auth/expo better-auth expo-secure-store

# For image handling
npm install expo-image-picker expo-file-system

# For HTTP requests (optional - fetch works fine)
npm install axios

# For state management (choose one)
npm install zustand
# or
npm install @tanstack/react-query
```

### 2. Configure Expo Scheme

In `app.json`:

```json
{
  "expo": {
    "scheme": "chi-expense",
    "plugins": [
      [
        "expo-secure-store",
        {
          "configureAndroidBackup": true,
          "faceIDPermission": "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
        }
      ]
    ]
  }
}
```

The `chi-expense://` scheme is whitelisted in the backend CORS config.

---

## Authentication with Better Auth

The backend uses [Better Auth](https://better-auth.com) with the `@better-auth/expo` plugin for native mobile authentication.

### Auth Client Setup

Create `lib/auth.ts`:

```typescript
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL, // e.g., "https://your-app.vercel.app"
  plugins: [
    expoClient({
      scheme: 'chi-expense',
      storage: SecureStore,
    }),
  ],
});

export { authClient };
```

### Social Login (GitHub)

```typescript
import { authClient } from '@/lib/auth';
import * as WebBrowser from 'expo-web-browser';

async function signInWithGitHub() {
  const data = await authClient.signIn.social({
    provider: 'github',
    callbackURL: 'chi-expense://',
  });

  // On success, the expo plugin handles the session token automatically
  // It's stored in SecureStore and sent as Bearer token on subsequent requests
}
```

### Apple Sign-In (iOS)

```typescript
import { authClient } from '@/lib/auth';

async function signInWithApple() {
  const data = await authClient.signIn.social({
    provider: 'apple',
    callbackURL: 'chi-expense://',
  });
}
```

> See [Apple OAuth Setup](./apple-oauth-setup.md) for backend configuration.

### Get Current Session

```typescript
const session = await authClient.getSession();
// session.token contains the Bearer token
// session.user contains { id, name, email, image }
```

### Sign Out

```typescript
await authClient.signOut();
```

---

## API Client Setup

Create `lib/api.ts`:

```typescript
import { authClient } from './auth';

const API_BASE = process.env.EXPO_PUBLIC_API_URL + '/api/v1';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await authClient.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message || `HTTP ${response.status}`,
      response.status,
      error
    );
  }

  return response.json();
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: any
  ) {
    super(message);
  }
}

export { apiRequest, ApiError };
```

---

## API Reference for Mobile

### Health Check

```http
GET /api/v1/health
```

**No auth required.** Use this to verify connectivity before other calls.

```typescript
const health = await apiRequest('/health');
// { status: "ok", database: "connected", redis: "connected", timestamp: "..." }
```

---

### Authentication Flows

Better Auth endpoints are available at `/api/auth/*`. Key flows:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signin/social` | GET | Initiate OAuth flow |
| `/api/auth/callback/:provider` | GET | OAuth callback |
| `/api/auth/signout` | POST | Clear session |
| `/api/auth/session` | GET | Get current session |

These are handled automatically by the Better Auth Expo client.

---

### Categories

```http
GET /api/v1/categories
Authorization: Bearer <token>
```

**Response:**
```json
[
  { "id": "abc123", "name": "Ăn uống", "slug": "an-uong", "budget": null },
  { "id": "def456", "name": "Di chuyển", "slug": "di-chuyen", "budget": null }
]
```

Categories are lazily initialized on first request (8 defaults created automatically).

```typescript
const categories = await apiRequest<Category[]>('/categories');
```

---

### Transactions

#### List Transactions

```http
GET /api/v1/transactions?month=2026-04&page=1&limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "txn_abc123",
      "amount": -35000,
      "merchant": "Cà phê",
      "category": "Ăn uống",
      "source": "text",
      "note": null,
      "createdAt": "2026-04-27T10:00:00.000Z",
      "updatedAt": "2026-04-27T10:00:00.000Z"
    }
  ],
  "total": 243,
  "hasMore": true
}
```

> **Note:** Amounts are stored as negative integers (expenses). Display as positive values in UI.

```typescript
interface TransactionListResponse {
  data: Transaction[];
  total: number;
  hasMore: boolean;
}

const list = await apiRequest<TransactionListResponse>(
  '/transactions?month=2026-04&page=1&limit=50'
);
```

#### Create Transaction

```http
POST /api/v1/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 35000,
  "merchant": "Cà phê Highlands",
  "category": "Ăn uống",
  "source": "manual",
  "note": "Morning coffee"
}
```

**Response:** Created transaction (amount stored as `-35000` internally).

```typescript
const newTx = await apiRequest<Transaction>('/transactions', {
  method: 'POST',
  body: JSON.stringify({
    amount: 35000,
    merchant: 'Cà phê Highlands',
    category: 'an-uong',
    source: 'manual',
    note: 'Morning coffee',
  }),
});
```

#### Update Transaction

```http
PATCH /api/v1/transactions/:id
Authorization: Bearer <token>

{
  "amount": 40000,
  "merchant": "Updated merchant"
}
```

#### Delete Transaction

```http
DELETE /api/v1/transactions/:id
Authorization: Bearer <token>
```

---

### AI Input Parsing

#### Parse Text

```http
POST /api/v1/input/text
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "cà phê 35k"
}
```

**Response:**
```json
{
  "amount": 35000,
  "merchant": "cà phê",
  "category": "Ăn uống"
}
```

```typescript
const parsed = await apiRequest<ParsedExpense>('/input/text', {
  method: 'POST',
  body: JSON.stringify({ message: 'cà phê 35k' }),
});
```

**Rate limit:** 20 requests/hour per user (via Upstash Redis).

#### Parse Image (Receipt)

```http
POST /api/v1/input/image
Authorization: Bearer <token>
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response:** Same shape as text parsing.

```typescript
const parsed = await apiRequest<ParsedExpense>('/input/image', {
  method: 'POST',
  body: JSON.stringify({ image: base64Image }),
});
```

> **Image requirements:** JPEG or PNG, base64 data URI format, max 15MB. Server resizes to 800px width before LLM processing.

---

### Insights

```http
GET /api/v1/insights?month=2026-04
Authorization: Bearer <token>
```

**Response:**
```json
{
  "month": "2026-04",
  "total": 1250000,
  "transactionCount": 45,
  "categoryBreakdown": [
    { "category": "Ăn uống", "total": 450000, "count": 20 }
  ],
  "dailyExpenses": [
    { "date": "2026-04-27", "total": 85000 }
  ]
}
```

---

### Account Management

#### Export Data (GDPR)

```http
GET /api/v1/account/export
Authorization: Bearer <token>
```

**Response:** All user data including transactions and categories.

#### Delete Account (App Store compliant)

```http
DELETE /api/v1/account
Authorization: Bearer <token>
```

**Response:** `{ "success": true }`

> **Warning:** This permanently deletes the user and all associated data. Required for App Store approval.

---

## React Native Code Examples

### Auth Hook

```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth';

export function useAuth() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then((s) => {
      setSession(s.data);
      setLoading(false);
    });
  }, []);

  const signIn = async (provider: 'github' | 'apple') => {
    await authClient.signIn.social({
      provider,
      callbackURL: 'chi-expense://',
    });
    const s = await authClient.getSession();
    setSession(s.data);
  };

  const signOut = async () => {
    await authClient.signOut();
    setSession(null);
  };

  return { session, loading, signIn, signOut };
}
```

### API Client with Fetch

```typescript
// lib/api.ts
import { authClient } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL + '/api/v1';

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const session = await authClient.getSession();
  const token = session.data?.token;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}
```

### Expense Input Screen

```typescript
// app/input.tsx
import { useState } from 'react';
import { View, TextInput, Button, Text, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';

export default function InputScreen() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTextInput = async () => {
    setLoading(true);
    try {
      const result = await api('/input/text', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      // result: { amount, merchant, category, note? }
      console.log('Parsed:', result);
      // Navigate to confirmation screen with parsed data
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageInput = async () => {
    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });

    if (!picker.canceled) {
      const asset = picker.assets[0];
      const base64 = `data:${asset.mimeType};base64,${asset.base64}`;

      setLoading(true);
      try {
        const result = await api('/input/image', {
          method: 'POST',
          body: JSON.stringify({ image: base64 }),
        });
        console.log('Parsed from image:', result);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        placeholder="e.g., cà phê 35k"
        value={message}
        onChangeText={setMessage}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <Button title="Parse Text" onPress={handleTextInput} disabled={loading} />
      <Button title="Scan Receipt" onPress={handleImageInput} disabled={loading} />
    </View>
  );
}
```

### Transaction List Screen

```typescript
// app/transactions.tsx
import { useEffect, useState } from 'react';
import { FlatList, Text, View, RefreshControl } from 'react-native';
import { api } from '@/lib/api';

interface Transaction {
  id: string;
  amount: number; // negative for expenses
  merchant: string;
  category: string;
  createdAt: string;
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadTransactions = async (pageNum: number) => {
    const month = new Date().toISOString().slice(0, 7); // "2026-04"
    const res = await api(`/transactions?month=${month}&page=${pageNum}&limit=50`);
    
    if (pageNum === 1) {
      setTransactions(res.data);
    } else {
      setTransactions((prev) => [...prev, ...res.data]);
    }
    setHasMore(res.hasMore);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadTransactions(1);
    setRefreshing(false);
  };

  const onLoadMore = () => {
    if (hasMore && !refreshing) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadTransactions(nextPage);
    }
  };

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => (
        <View style={{ padding: 15, borderBottomWidth: 1 }}>
          <Text style={{ fontWeight: 'bold' }}>{item.merchant}</Text>
          <Text>{Math.abs(item.amount).toLocaleString()}đ · {item.category}</Text>
          <Text style={{ fontSize: 12, color: '#666' }}>
            {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          </Text>
        </View>
      )}
    />
  );
}
```

---

## Image Handling

When sending receipt images:

1. **Use `expo-image-picker`** with `base64: true`
2. **Prefix with data URI:** `data:image/jpeg;base64,...`
3. **Server handles optimization** (resizes to 800px, JPEG 85%)
4. **Max original size:** 15MB (enforced by DTO validation)

```typescript
const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.9, // slightly reduced to save bandwidth
  });

  if (!result.canceled) {
    const asset = result.assets[0];
    return `data:${asset.mimeType};base64,${asset.base64}`;
  }
};
```

---

## Error Handling

Common HTTP status codes:

| Status | Meaning | Action |
|--------|---------|--------|
| `200` | Success | Continue |
| `201` | Created | Continue |
| `400` | Bad Request | Check request body/params |
| `401` | Unauthorized | Re-authenticate user |
| `404` | Not Found | Item doesn't exist |
| `408` | Request Timeout | Retry the request |
| `422` | Unprocessable Entity | Invalid image format |
| `429` | Rate Limited | Wait before retrying |
| `503` | Service Unavailable | Backend degraded or shutting down |

```typescript
try {
  const data = await api('/input/text', { ... });
} catch (error: any) {
  if (error.status === 429) {
    alert('Too many requests. Please try again later.');
  } else if (error.status === 408) {
    alert('Request timed out. Please retry.');
  } else {
    alert(error.message);
  }
}
```

---

## Rate Limiting

AI endpoints (`/input/text`, `/input/image`) are rate-limited:

- **Limit:** 20 requests per hour per user
- **Exceeding:** Returns `429 Too Many Requests`

No rate limiting on CRUD endpoints (protected by auth).

---

## Environment Configuration

Create `.env` in your Expo project:

```env
# Development
EXPO_PUBLIC_API_URL=http://localhost:3000

# Production
# EXPO_PUBLIC_API_URL=https://your-app.vercel.app
```

> Use `EXPO_PUBLIC_` prefix for variables accessible in client code.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `CORS error` | Origin not whitelisted | Add your app scheme (`chi-expense://`) to backend `allowedOrigins` |
| `401 Unauthorized` | Missing/invalid Bearer token | Ensure `authClient.getSession()` returns a token before API calls |
| `429 Too Many Requests` | Rate limit hit | Wait and retry; implement client-side cooldown |
| `408 Request Timeout` | LLM call took >25s | Retry; check OpenRouter API status |
| `422 Unprocessable Entity` | Invalid image format | Ensure base64 prefix is `data:image/jpeg;base64,` or `data:image/png;base64,` |
| Apple Sign-In fails | Invalid redirect URI | Register exact callback URL in Apple Developer Portal |
| Session not persisting | SecureStore issue | Verify `expo-secure-store` is configured in `app.json` |

---

## TypeScript Types

```typescript
// types/api.ts
export interface Category {
  id: string;
  name: string;
  slug: string;
  budget: number | null;
}

export interface Transaction {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  source: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedExpense {
  amount: number;
  merchant: string;
  category: string;
  note?: string;
}

export interface MonthlyInsights {
  month: string;
  total: number;
  transactionCount: number;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  dailyExpenses: Array<{
    date: string;
    total: number;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}
```

---

*Last updated: 2026-04-27 | Backend version: v1.1*
