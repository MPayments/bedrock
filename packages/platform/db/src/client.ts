import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema/index";
import type { Database } from "./types";

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: +(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "postgres",
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
});

export const db: Database = drizzle(pool, { schema });

export type { Database, Transaction } from "./types";
