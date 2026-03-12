import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { schema } from "@bedrock/accounting/schema";

import { createAccountingRuntime } from "../../src/runtime";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false,
});

const db = drizzle(pool, { schema });
const createdBookIds = new Set<string>();
const INTERNAL_LEDGER_GROUP_CODE = "treasury_internal_entities";
const TREASURY_ROOT_GROUP_CODE = "treasury";
const TEST_INTERNAL_COUNTERPARTY_ID = "00000000-0000-4000-8000-00000000f202";

async function resolveInternalLedgerCounterpartyId(): Promise<string> {
  await pool.query(
    `
      INSERT INTO counterparty_groups (code, name, description, parent_id, customer_id, is_system)
      VALUES ($1, 'Treasury', 'System root for treasury counterparties', NULL, NULL, true)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          parent_id = NULL,
          customer_id = NULL,
          is_system = true
    `,
    [TREASURY_ROOT_GROUP_CODE],
  );

  const rootResult = await pool.query<{ id: string }>(
    "SELECT id::text AS id FROM counterparty_groups WHERE code = $1 LIMIT 1",
    [TREASURY_ROOT_GROUP_CODE],
  );
  const treasuryRootGroupId = rootResult.rows[0]?.id;
  if (!treasuryRootGroupId) {
    throw new Error("Failed to resolve treasury root group for integration test");
  }

  await pool.query(
    `
      INSERT INTO counterparty_groups (code, name, description, parent_id, customer_id, is_system)
      VALUES ($1, 'Treasury Internal Ledger Entities', 'Integration test internal entities', $2::uuid, NULL, true)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          parent_id = EXCLUDED.parent_id,
          customer_id = NULL,
          is_system = true
    `,
    [INTERNAL_LEDGER_GROUP_CODE, treasuryRootGroupId],
  );

  const internalGroupResult = await pool.query<{ id: string }>(
    "SELECT id::text AS id FROM counterparty_groups WHERE code = $1 LIMIT 1",
    [INTERNAL_LEDGER_GROUP_CODE],
  );
  const internalGroupId = internalGroupResult.rows[0]?.id;
  if (!internalGroupId) {
    throw new Error("Failed to resolve treasury internal ledger group for integration test");
  }

  await pool.query(
    `
      INSERT INTO counterparties (id, short_name, full_name, kind, country)
      VALUES ($1::uuid, 'Integration Internal Entity', 'Integration Internal Entity', 'legal_entity', 'US')
      ON CONFLICT (id) DO UPDATE
      SET short_name = EXCLUDED.short_name,
          full_name = EXCLUDED.full_name,
          kind = EXCLUDED.kind,
          country = EXCLUDED.country
    `,
    [TEST_INTERNAL_COUNTERPARTY_ID],
  );

  await pool.query(
    `
      INSERT INTO counterparty_group_memberships (counterparty_id, group_id)
      VALUES ($1::uuid, $2::uuid)
      ON CONFLICT (counterparty_id, group_id) DO NOTHING
    `,
    [TEST_INTERNAL_COUNTERPARTY_ID, internalGroupId],
  );

  return TEST_INTERNAL_COUNTERPARTY_ID;
}

async function cleanupCreatedBooks() {
  const bookIds = Array.from(createdBookIds);
  if (bookIds.length === 0) {
    return;
  }

  await db
    .delete(schema.accountingPackAssignments)
    .where(inArray(schema.accountingPackAssignments.scopeId, bookIds));
  await db.delete(schema.books).where(inArray(schema.books.id, bookIds));
  createdBookIds.clear();
}

describe("accounting pack activation integration", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  afterEach(async () => {
    await cleanupCreatedBooks();
  });

  afterAll(async () => {
    await cleanupCreatedBooks();
    await pool.end();
  });

  it("stores, activates, and loads a compiled pack for a book scope", async () => {
    const runtime = createAccountingRuntime({
      db,
      defaultPackDefinition: rawPackDefinition,
    });
    const bookId = randomUUID();
    const internalCounterpartyId = await resolveInternalLedgerCounterpartyId();
    createdBookIds.add(bookId);

    await db.insert(schema.books).values({
      id: bookId,
      organizationId: internalCounterpartyId,
      code: `it-pack-${bookId}`,
      name: "Integration Pack Book",
      isDefault: false,
    });

    const compiled = await runtime.storeCompiledPackVersion({
      definition: rawPackDefinition,
    });
    const effectiveAt = new Date("2026-02-28T09:00:00.000Z");

    await runtime.activatePackForScope({
      scopeId: bookId,
      packChecksum: compiled.checksum,
      effectiveAt,
    });

    const loaded = await runtime.loadActiveCompiledPackForBook({
      bookId,
      at: new Date("2026-02-28T10:00:00.000Z"),
    });

    expect(loaded.checksum).toBe(compiled.checksum);

    const [assignment] = await db
      .select()
      .from(schema.accountingPackAssignments)
      .where(eq(schema.accountingPackAssignments.scopeId, bookId))
      .limit(1);

    expect(assignment).toEqual(
      expect.objectContaining({
        scopeType: "book",
        scopeId: bookId,
        packChecksum: compiled.checksum,
      }),
    );
  });
});
