import "server-only";

import { Pool } from "pg";

import { createPostgresDatabase } from "@bedrock/platform/persistence/postgres";

import { deals } from "@bedrock/deals/schema";
import { user } from "@bedrock/iam/schema";

import { crmTasks } from "@/lib/server/tasks/schema";

const schema = {
  crmTasks,
  deals,
  user,
};

// Next.js dev server may not inherit DB env vars from the monorepo root .env.
// Use DATABASE_URL if available, otherwise fall back to explicit config.
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    `postgresql://${process.env.DB_USER ?? "postgres"}:${process.env.DB_PASSWORD ?? "postgres"}@${process.env.DB_HOST ?? "localhost"}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_NAME ?? "postgres"}`,
});

export const crmTasksDb = createPostgresDatabase({ schema, pool });
