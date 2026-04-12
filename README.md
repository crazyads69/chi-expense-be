# Chi Expense Backend

> **Zero-friction expense tracking backend powered by NestJS, Better Auth, and LLM parsing.**

[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E.svg?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![Better Auth](https://img.shields.io/badge/Better%20Auth-1.6-black.svg?style=for-the-badge)](https://better-auth.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C4D21E.svg?style=for-the-badge&logo=drizzle)](https://orm.drizzle.team/)
[![Turso](https://img.shields.io/badge/Turso-SQLite-4ade80.svg?style=for-the-badge)](https://turso.tech/)
[![Vercel](https://img.shields.io/badge/Vercel-Ready-black.svg?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

Chi Expense is the backend service for a zero-friction expense tracking application. It provides a robust REST API for managing users, tracking transactions, and leverages OpenRouter LLMs (Qwen/GPT-4o-mini) to automatically parse raw text and receipt images into structured expense data. 

This project is built to be **App Store compliant**, multi-tenant safe, and optimized for serverless deployment on Vercel.

---

## ✨ Key Features

* 🔐 **Auth & Identity:** GitHub and Apple OAuth via [Better Auth](https://better-auth.com/). Built-in App Store compliance with cascade account deletion.
* 🤖 **AI Expense Parsing:** Submit raw Vietnamese text (e.g., *"cà phê 35k"*) or receipt images and automatically extract amounts, merchants, and categories using OpenRouter.
* ⚡ **Serverless Ready:** Fully configured to deploy as a Vercel Function using `@vercel/node`.
* 🗄️ **Edge Database:** Lightning-fast edge SQLite via Turso and Drizzle ORM.
* 🛡️ **Security & Rate Limiting:** Global validation pipes, strict CORS policies, and Upstash Redis rate-limiting on LLM endpoints to prevent abuse.
* 📊 **Observability:** High-performance structured JSON logging with `nestjs-pino`.

---

## 🏗️ Architecture & Tech Stack

### Framework & Infrastructure
* **Framework:** NestJS 11
* **Runtime:** Node.js 20.x (Optimized for Vercel Fluid Compute)
* **Deployment:** Vercel Serverless Functions

### Core Modules
* **Authentication:** Better Auth (`@thallesp/nestjs-better-auth`)
* **Database:** Turso (libSQL) + Drizzle ORM
* **AI/LLM:** OpenRouter via `openai` SDK (Qwen3-8B for text, GPT-4o-mini for OCR)
* **Rate Limiting:** Upstash Redis + `@upstash/ratelimit`
* **Validation:** `class-validator` & `class-transformer`

### Project Structure
```text
chi-expense-be/
├── src/
│   ├── account/          # Account management, GDPR export, cascade deletion
│   ├── categories/       # User expense category management
│   ├── db/               # Turso database client and Drizzle schema
│   ├── input/            # AI parsing endpoints (text/image) and rate limiting
│   ├── insights/         # Monthly spending analytics and summaries
│   ├── lib/              # Core utilities (auth, redis, openrouter, prompts)
│   ├── transactions/     # Core CRUD for user expenses
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point (CORS, Pipes configured for Vercel)
├── docs/                 # Architecture specs and documentation
├── drizzle.config.ts     # Drizzle ORM configuration
├── vercel.json           # Vercel deployment configuration
└── package.json          # Dependencies and scripts
```

---

## 🚀 Getting Started

Follow these steps to set up the backend locally.

### 1. Prerequisites

Before you begin, ensure you have the following accounts and tools:
* **Node.js** (v20+ recommended)
* A [Turso](https://turso.tech/) account (for the edge SQLite database)
* An [OpenRouter](https://openrouter.ai/) account (for AI parsing credits)
* An [Upstash](https://upstash.com/) account (for Redis rate limiting)
* A GitHub account (to set up an OAuth app)

### 2. Clone & Install

```bash
git clone https://github.com/yourusername/chi-expense-be.git
cd chi-expense-be
npm install
```

### 3. Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

**Core Auth**
```env
BETTER_AUTH_SECRET="Generate with: openssl rand -base64 32"
BETTER_AUTH_URL="http://localhost:3000"
```

**Database (Turso)**
```env
TURSO_CONNECTION_URL="libsql://your-db-name.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
```

**Social Login (GitHub)**
*Go to GitHub -> Developer Settings -> OAuth Apps -> New OAuth App*
* **Homepage URL:** `http://localhost:3000`
* **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
```env
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

**AI & Rate Limiting**
```env
OPENROUTER_API_KEY="sk-or-v1-..."
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

### 4. Database Migration

Push the Drizzle schema to your Turso database to create the required tables:
```bash
npx drizzle-kit push
```

### 5. Run the Server

Start the development server with hot-reload enabled:
```bash
npm run start:dev
```
The API will be available at `http://localhost:3000`.

You can test the health endpoint to verify the server is running:
```bash
curl http://localhost:3000/api/health
```

---

## 🌐 API Reference

| Method | Path | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Public health check | No |
| `POST` | `/api/input/text` | Parse raw text into an expense | Yes (Bearer) |
| `POST` | `/api/input/image` | Parse a base64 image into an expense | Yes (Bearer) |
| `GET` | `/api/transactions` | List monthly transactions | Yes (Bearer) |
| `POST` | `/api/transactions` | Create a transaction manually | Yes (Bearer) |
| `PATCH` | `/api/transactions/:id` | Update a transaction | Yes (Bearer) |
| `DELETE`| `/api/transactions/:id` | Delete a transaction | Yes (Bearer) |
| `GET` | `/api/insights` | Get monthly spending breakdown | Yes (Bearer) |
| `GET` | `/api/categories` | List user categories | Yes (Bearer) |
| `GET` | `/api/account/export` | Export user data (GDPR compliant) | Yes (Bearer) |
| `DELETE`| `/api/account` | Delete user and all data (App Store compliant) | Yes (Bearer) |

---

## ☁️ Deployment (Vercel)

This application is specifically architected to deploy seamlessly to Vercel Serverless Functions using the `@vercel/node` builder.

1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Set **all environment variables** in the Vercel dashboard settings.
4. Ensure the Framework Preset is set to **NestJS** or run the build command `npm run vercel-build`.
5. Deploy!

> **Note:** Vercel's free "Hobby" tier prohibits commercial use. If you plan to monetize this app on the App Store, you must upgrade to the **Pro ($20/month)** tier.

---

## 🛠️ Scripts & Maintenance

* `npm run build`: Compiles the NestJS application to the `dist` folder.
* `npm run format`: Formats code using Prettier.
* `npm run lint`: Runs ESLint across the codebase.
* `npm run test`: Executes unit tests via Jest.
* `npm run test:e2e`: Executes end-to-end tests.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.