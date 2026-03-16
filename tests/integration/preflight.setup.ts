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
  max: 1,
  connectionTimeoutMillis: 5_000,
};

beforeAll(async () => {
  const pool = new Pool(testDbConfig);

  try {
    await pool.query("SELECT 1");
    await assertIntegrationDbSchemaState(pool);
  } catch (error) {
    const connectionTarget = `${testDbConfig.host}:${testDbConfig.port}/${testDbConfig.database}`;
    throw new Error(
      `Integration DB preflight failed for ${connectionTarget}. Ensure Postgres is reachable and run the hard-cutover path: db:nuke -> db:migrate -> db:seed.`,
      {
        cause: error,
      },
    );
  } finally {
    await pool.end();
  }
}, 60_000);
