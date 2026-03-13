import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(dir, "../../../.env") });

export default defineConfig({
  schema: "./src/schema/index.ts",

  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST ?? "localhost",
    port: +(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? "postgres",
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
    ssl: false,
  },
  verbose: true,
  casing: "snake_case",
});
