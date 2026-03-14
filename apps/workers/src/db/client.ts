import type { Database } from "@bedrock/platform/persistence";
import { createPostgresDatabase } from "@bedrock/platform/persistence/postgres";

export const db: Database = createPostgresDatabase();
