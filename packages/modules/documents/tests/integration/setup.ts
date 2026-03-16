import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { schema as documentsSchema } from "../../src/infra/drizzle/schema";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, documentsSchema);

async function cleanupDocumentsTables() {
  await pool.query("DELETE FROM document_snapshots");
  await pool.query("DELETE FROM document_links");
  await pool.query("DELETE FROM document_events");
  await pool.query("DELETE FROM document_operations");
  await pool.query("DELETE FROM documents");
  await pool.query(
    "DELETE FROM \"user\" WHERE email LIKE 'documents-it-%@example.com'",
  );
}

registerPgIntegrationLifecycle({
  name: "documents",
  pool,
  cleanup: cleanupDocumentsTables,
});

export { db, pool };
