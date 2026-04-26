# Chi Expense — App Integration Guide

> **Version:** 1.0.0 · **Date:** April 12, 2026

This document describes how to integrate the **Chi Expense** Expo mobile app with the NestJS backend.

---

## Table of Contents

1. [Backend API Summary](#1-backend-api-summary)
2. [Authentication Flow](#2-authentication-flow)
3. [API Integration Patterns](#3-api-integration-patterns)
4. [Transaction Flow](#4-transaction-flow)
5. [Input/AI Parsing Flow](#5-inputai-parsing-flow)
6. [Insights & Categories](#6-insights--categories)
7. [Account Management](#7-account-management)
8. [Error Handling](#8-error-handling)
9. [Environment Configuration](#9-environment-configuration)

---

## 1. Backend API Summary

### Base URL

```
Production: https://chi-expense.vercel.app/api
Local: http://localhost:3000/api
```

### Authentication

All endpoints except `/api/health` and `/api/auth/*` require a Bearer token:

```
Authorization: Bearer <session_token>
```

### Endpoints Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | ❌ | Health check |
| POST | `/auth/sign-in/github` | ❌ | Start GitHub OAuth |
| GET | `/auth/callback/github` | ❌ | OAuth callback |
| POST | `/auth/sign-out` | ✅ | Sign out |
| GET | `/auth/get-session` | ✅ | Get current session |
| POST | `/input/text` | ✅ | Parse text expense |
| POST | `/input/image` | ✅ | Parse receipt image |
| GET | `/transactions` | ✅ | List transactions |
| POST | `/transactions` | ✅ | Create transaction |
| PATCH | `/transactions/:id` | ✅ | Update transaction |
| DELETE | `/transactions/:id` | ✅ | Delete transaction |
| GET | `/insights` | ✅ | Monthly insights |
| GET | `/categories` | ✅ | List categories |
| DELETE | `/account` | ✅ | Delete account |
| GET | `/account/export` | ✅ | Export user data |

---

## 2. Authentication Flow

### 2.1 Setup

Install dependencies:

```bash
npm install better-auth @better-auth/expo expo-secure-store
```

### 2.2 Auth Client Configuration

Create `lib/auth-client.ts`:

```typescript
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://chi-expense.vercel.app',
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

### 2.3 Sign-In Flow

```typescript
import { signIn } from '@/lib/auth-client';

async function handleGitHubSignIn() {
  try {
    const { data, error } = await signIn.github();
    if (error) {
      console.error('Sign in failed:', error);
      return;
    }
    // Session is automatically stored in SecureStore
    // User is redirected via deep link
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}
```

### 2.4 Session Persistence

The session is automatically persisted in SecureStore via the expoClient plugin. On app restart:

```typescript
import { useSession } from '@/lib/auth-client';

function App() {
  const { data: session, isLoading } = useSession();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!session) {
    return <SignInScreen />;
  }

  return <HomeScreen />;
}
```

### 2.5 Sign-Out

```typescript
import { signOut } from '@/lib/auth-client';

async function handleSignOut() {
  await signOut();
  // User is signed out, session cleared from SecureStore
}
```

### 2.6 Deep Link Configuration

In `app.json`:

```json
{
  "expo": {
    "scheme": "chi-expense"
  }
}
```

Backend trusted origins must include `chi-expense://` and `exp://` for development.

---

## 3. API Integration Patterns

### 3.1 API Client Setup

Create `lib/api.ts`:

```typescript
import { useSession } from './auth-client';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://chi-expense.vercel.app';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const { data: session } = useSession.getSession();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
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
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}
```

### 3.2 Authenticated Fetch Hook

Create `hooks/useApi.ts`:

```typescript
import { useSession } from '@/lib/auth-client';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://chi-expense.vercel.app';

export function useApi() {
  const { data: session } = useSession();

  const api = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
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
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json();
  };

  return { api };
}
```

---

## 4. Transaction Flow

### 4.1 List Transactions

```typescript
import { useApi } from '@/hooks/useApi';
import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  source: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

function TransactionsScreen() {
  const { api } = useApi();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState('2026-04'); // YYYY-MM format

  useEffect(() => {
    loadTransactions();
  }, [month]);

  async function loadTransactions() {
    try {
      const data = await api<Transaction[]>(`/transactions?month=${month}`);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TransactionRow transaction={item} />
      )}
    />
  );
}
```

**Response Example:**

```json
[
  {
    "id": "abc123",
    "amount": -35000,
    "merchant": "Cà phê",
    "category": "Ăn uống",
    "source": "text",
    "note": null,
    "createdAt": "2026-04-12T08:30:00.000Z",
    "updatedAt": "2026-04-12T08:30:00.000Z"
  }
]
```

**Note:** Amounts are **negative** in API responses (stored as expenses). Display as absolute value with "-" prefix.

### 4.2 Create Transaction

```typescript
interface CreateTransactionInput {
  amount: number;      // Positive integer (API negates internally)
  merchant: string;
  category: string;
  source: 'text' | 'voice' | 'image' | 'sms';
  note?: string;
}

async function createTransaction(input: CreateTransactionInput) {
  const { api } = useApi();

  const transaction = await api<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return transaction;
}

// Usage after AI parsing confirmation
async function handleConfirm(parsedExpense: ParsedExpense) {
  const transaction = await createTransaction({
    amount: parsedExpense.amount,    // Positive number
    merchant: parsedExpense.merchant,
    category: parsedExpense.category,
    source: 'text',
    note: parsedExpense.note,
  });

  // Add to list at top (newest first)
  setTransactions(prev => [transaction, ...prev]);
}
```

### 4.3 Update Transaction

```typescript
async function updateTransaction(id: string, updates: Partial<CreateTransactionInput>) {
  const { api } = useApi();

  const transaction = await api<Transaction>(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  return transaction;
}
```

### 4.4 Delete Transaction

```typescript
async function deleteTransaction(id: string) {
  const { api } = useApi();

  await api(`/transactions/${id}`, {
    method: 'DELETE',
  });

  // Remove from list
  setTransactions(prev => prev.filter(t => t.id !== id));
}
```

---

## 5. Input/AI Parsing Flow

### 5.1 Text Parsing

```typescript
interface ParsedExpense {
  amount: number;       // Positive integer
  merchant: string;
  category: string;
  note?: string;
}

async function parseTextExpense(message: string): Promise<ParsedExpense> {
  const { api } = useApi();

  const result = await api<ParsedExpense>('/input/text', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });

  return result;
}

// Usage
async function handleSubmitText(text: string) {
  setIsLoading(true);
  try {
    const parsed = await parseTextExpense(text);
    showConfirmationCard(parsed);
  } catch (error) {
    showError('Không thể phân tích. Vui lòng thử lại.');
  } finally {
    setIsLoading(false);
  }
}
```

**Request:**

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

### 5.2 Image Parsing (Receipt OCR)

```typescript
import * as ImageManipulator from 'expo-image-manipulator';

async function parseReceiptImage(uri: string): Promise<ParsedExpense> {
  const { api } = useApi();

  // Compress and convert to base64
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const base64Image = `data:image/jpeg;base64,${manipulated.base64}`;

  const result = await api<ParsedExpense>('/input/image', {
    method: 'POST',
    body: JSON.stringify({ image: base64Image }),
  });

  return result;
}
```

**Request:**

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### 5.3 Complete Input Flow

```typescript
function QuickAddBottomSheet() {
  const [inputText, setInputText] = useState('');
  const [parsedExpense, setParsedExpense] = useState<ParsedExpense | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (!inputText.trim()) return;

    setIsLoading(true);
    try {
      const parsed = await parseTextExpense(inputText);
      setParsedExpense(parsed);
    } catch (error) {
      showError('Thử lại');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!parsedExpense) return;

    const transaction = await createTransaction({
      ...parsedExpense,
      source: 'text',
    });

    // Close sheet, refresh list
    onTransactionCreated(transaction);
    setParsedExpense(null);
    setInputText('');
  }

  function handleEdit() {
    // Keep parsedExpense, allow user to modify before confirming
  }

  function handleCancel() {
    setParsedExpense(null);
    setInputText('');
    closeSheet();
  }

  if (parsedExpense) {
    return (
      <ConfirmCard
        amount={parsedExpense.amount}
        merchant={parsedExpense.merchant}
        category={parsedExpense.category}
        onConfirm={handleConfirm}
        onEdit={handleEdit}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <Sheet>
      <TextInput
        value={inputText}
        onChangeText={setInputText}
        placeholder="cà phê 35k..."
      />
      {isLoading ? (
        <Skeleton />
      ) : (
        <Button title="Gửi" onPress={handleSubmit} />
      )}
    </Sheet>
  );
}
```

### 5.4 Amount Formatting

```typescript
const VND_FORMAT = new Intl.NumberFormat('vi-VN');

function formatAmount(amount: number): string {
  // amount is negative from API, take absolute value
  const absAmount = Math.abs(amount);
  return `${VND_FORMAT.format(absAmount)} ₫`;
}

// Usage
<Text style={styles.amount}>
  {formatAmount(-35000)}  // Displays: "35.000 ₫"
</Text>
```

---

## 6. Insights & Categories

### 6.1 Monthly Insights

```typescript
interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

interface DailyExpense {
  date: string;        // "2026-04-12"
  total: number;
}

interface MonthlyInsights {
  month: string;           // "2026-04"
  total: number;           // Total spending (positive)
  transactionCount: number;
  categoryBreakdown: CategoryBreakdown[];
  dailyExpenses: DailyExpense[];
}

async function loadInsights(month?: string) {
  const { api } = useApi();

  const insights = await api<MonthlyInsights>(
    `/insights${month ? `?month=${month}` : ''}`
  );

  return insights;
}

// Usage
function ReportScreen() {
  const { api } = useApi();
  const [insights, setInsights] = useState<MonthlyInsights | null>(null);

  useEffect(() => {
    loadInsights().then(setInsights);
  }, []);

  if (!insights) return <Skeleton />;

  return (
    <View>
      <Text style={styles.totalAmount}>
        {formatAmount(-insights.total)}
      </Text>
      <Text>THÁNG 4, 2026</Text>

      {insights.categoryBreakdown.map((cat) => (
        <CategoryRow
          key={cat.category}
          name={cat.name}
          amount={cat.total}
          count={cat.count}
        />
      ))}
    </View>
  );
}
```

### 6.2 Categories

```typescript
interface Category {
  id: string;
  name: string;
  slug: string;
  budget: number | null;
}

async function loadCategories() {
  const { api } = useApi();

  const categories = await api<Category[]>('/categories');

  return categories;
}

// Default categories returned for new users:
// - Ăn uống (an-uong)
// - Di chuyển (di-chuyen)
// - Mua sắm (mua-sam)
// - Giải trí (giai-tri)
// - Hóa đơn (hoa-don)
// - Sức khỏe (suc-khoe)
// - Giáo dục (giao-duc)
// - Khác (khac)
```

---

## 7. Account Management

### 7.1 Delete Account

```typescript
import { signOut } from '@/lib/auth-client';

async function handleDeleteAccount() {
  const { api } = useApi();

  try {
    await api('/account', { method: 'DELETE' });
    await signOut();
    // Navigate to sign-in screen
  } catch (error) {
    showError('Không thể xóa tài khoản');
  }
}
```

**Note:** Account deletion:
- Deletes all user transactions
- Deletes all user categories
- Deletes all auth sessions
- Signs user out automatically

### 7.2 Export Data (GDPR)

```typescript
interface ExportedData {
  exportedAt: string;
  transactions: Transaction[];
  categories: Category[];
}

async function handleExportData() {
  const { api } = useApi();

  const data = await api<ExportedData>('/account/export');

  // Save to device or share
  await Share.share({
    message: JSON.stringify(data, null, 2),
    title: 'Chi Expense Data Export',
  });
}
```

---

## 8. Error Handling

### 8.1 Error Types

```typescript
interface ApiError {
  message: string;
  statusCode?: number;
}

// Common errors:
const ERROR_MESSAGES = {
  400: 'Yêu cầu không hợp lệ',
  401: 'Vui lòng đăng nhập lại',
  403: 'Không có quyền truy cập',
  404: 'Không tìm thấy',
  429: 'Đã đạt giới hạn. Vui lòng thử lại sau.',
  500: 'Lỗi máy chủ. Vui lòng thử lại sau.',
};
```

### 8.2 Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }

  throw lastError!;
}

// Usage
async function resilientLoad() {
  const data = await withRetry(() => loadTransactions());
}
```

### 8.3 Offline Handling

```typescript
import { useNetworkState } from 'expo-network';

function useOnlineStatus() {
  const networkState = useNetworkState();
  return networkState.isConnected ?? false;
}

function TransactionsScreen() {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    return (
      <View style={styles.offline}>
        <Text>Không có kết nối mạng</Text>
        <Text>Các giao dịch sẽ được đồng bộ khi có mạng</Text>
      </View>
    );
  }

  return <TransactionList />;
}
```

---

## 9. Environment Configuration

### 9.1 Expo Environment Variables

Create `.env` in the Expo app root:

```
EXPO_PUBLIC_API_URL=https://chi-expense.vercel.app
```

### 9.2 App.json Configuration

```json
{
  "expo": {
    "scheme": "chi-expense",
    "name": "Chi Expense",
    "slug": "chi-expense",
    "version": "1.0.0",
    "orientation": "portrait",
    "ios": {
      "bundleIdentifier": "com.chiexpense.app",
      "minimumVersion": "15.1"
    },
    "android": {
      "package": "com.chiexpense.app",
      "versionCode": 1
    }
  }
}
```

### 9.3 Deep Link Configuration

The app scheme `chi-expense://` must be configured:

**iOS:** Add to `ios/chiexpense/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>chi-expense</string>
    </array>
  </dict>
</array>
```

**Android:** Add intent filter in `AndroidManifest.xml`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="chi-expense" />
</intent-filter>
```

---

## Appendix: API Response Types

### Transaction

```typescript
interface Transaction {
  id: string;
  userId: string;
  amount: number;        // Negative for expenses
  merchant: string;
  category: string;
  source: 'text' | 'voice' | 'image' | 'sms';
  note: string | null;
  createdAt: string;      // ISO 8601
  updatedAt: string;     // ISO 8601
}
```

### ParsedExpense

```typescript
interface ParsedExpense {
  amount: number;         // Positive integer (VND)
  merchant: string;
  category: string;
  note?: string;
}
```

### MonthlyInsights

```typescript
interface MonthlyInsights {
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
```

---

> **End of integration guide.**
