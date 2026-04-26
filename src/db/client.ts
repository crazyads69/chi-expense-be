import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';
import * as schema from './schema';

// HTTP client for stateless serverless compatibility (Vercel).
// WebSocket transport cannot survive cold starts — HTTP REST works everywhere.
// Note: TURSO_SYNC_URL is not supported with HTTP transport.
const client = createClient({
  url: process.env.TURSO_CONNECTION_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
