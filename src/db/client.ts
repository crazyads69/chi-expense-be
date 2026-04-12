import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncUrl: process.env.TURSO_SYNC_URL, // Optional for embedded replicas
});

export const db = drizzle(client, { schema });
