import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolvePostgresConnectionConfig } from "@bedrock/platform/persistence/postgres";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../.env") });
const dbCredentials = resolvePostgresConnectionConfig();

export default defineConfig({
  schema: [
    "../../packages/platform/src/auth-model/schema.ts",
    "../../packages/platform/src/idempotency-postgres/schema.ts",
    "../../packages/modules/*/src/schema.ts",
    "../../packages/modules/*/src/schema/**/*.ts",
    "../../packages/modules/*/src/**/schema.ts",
    "../../packages/modules/*/src/**/schema/**/*.ts",
  ],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: dbCredentials.host,
    port: dbCredentials.port,
    database: dbCredentials.database,
    user: dbCredentials.user,
    password: dbCredentials.password,
    ssl: dbCredentials.ssl,
  },
  verbose: true,
  casing: "snake_case",
});
