import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from '../db/schema';
import { Database as BunDatabase } from "bun:sqlite";

const sqlite = new BunDatabase("sqlite.db");
export const db = drizzle(sqlite, { schema });

export type Database = typeof db;