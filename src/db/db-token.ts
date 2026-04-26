import { type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDatabase = LibSQLDatabase<typeof schema>;
