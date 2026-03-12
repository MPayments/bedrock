import { Pool } from "pg";
import { beforeAll } from "vitest";

import { assertIntegrationDbSchemaState } from "./preflight";

const testDbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false,
};

beforeAll(async () => {
  const pool = new Pool(testDbConfig);

  try {
    await pool.query("SELECT 1");
    await assertIntegrationDbSchemaState(pool);
  } finally {
    await pool.end();
  }
}, 30_000);
