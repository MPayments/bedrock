import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { schema } from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
