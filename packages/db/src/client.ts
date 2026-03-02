import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema/index";

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: +(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "postgres",
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
});

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
