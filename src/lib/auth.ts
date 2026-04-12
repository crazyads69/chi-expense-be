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
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    },
  },
  plugins: [expo(), bearer()],
  account: {
    accountLinking: { enabled: true },
  },
  user: {
    deleteUser: { enabled: true },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    // In serverless environments (like Vercel), requests may be forwarded through proxies
    // and originate from different subdomains/origins, causing CSRF/Origin checks to fail
    // for mobile app clients sending Bearer tokens.
    crossSubDomainCookies: {
      enabled: true,
    },
    defaultSameSite: 'none', // Needed for cross-origin OAuth callbacks in Expo
  },
});
