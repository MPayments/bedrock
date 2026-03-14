import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { createPostgresDatabase } from "@bedrock/platform/persistence/postgres";

import { schema } from "./schema-registry";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const db: Database = createPostgresDatabase({ schema });
