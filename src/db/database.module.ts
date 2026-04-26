import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';
import * as schema from './schema';
import { DRIZZLE } from './db-token';
import type { DrizzleDatabase } from './db-token';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (): DrizzleDatabase => {
        const client = createClient({
          url: process.env.TURSO_CONNECTION_URL || 'file:local.db',
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
