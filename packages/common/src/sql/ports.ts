import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type Database = NodePgDatabase<any>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
