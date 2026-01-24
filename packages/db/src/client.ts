import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: +(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "postgres",
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  ssl: false,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db
