import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { schema as balancesSchema } from "@bedrock/balances/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { canonicalJson } from "@bedrock/core/canon";
import { sha256Hex } from "@bedrock/core/crypto";

import { createBalancesProjectorWorkerDefinition } from "../../src/worker";

const schema = {
  ...balancesSchema,
  ...ledgerSchema,
};

async function runWorkerOnce(
  worker: ReturnType<typeof createBalancesProjectorWorkerDefinition>,
) {
  const result = await worker.runOnce({
    now: new Date("2026-03-01T00:00:00Z"),
    signal: new AbortController().signal,
  });
  return result.processed;
}

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
const createdOperationIds = new Set<string>();
const INTERNAL_LEDGER_GROUP_CODE = "treasury_internal_entities";
const TREASURY_ROOT_GROUP_CODE = "treasury";
const TEST_INTERNAL_COUNTERPARTY_ID = "00000000-0000-4000-8000-00000000f201";
const ISOLATED_CURSOR_POSTED_AT = new Date("2099-01-01T00:00:00.000Z");
const ISOLATED_CURSOR_OPERATION_ID = "00000000-0000-0000-0000-000000000000";

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

async function cleanupRows() {
  const operationIds = Array.from(createdOperationIds);
  const bookIds = Array.from(createdBookIds);

  await db
    .delete(schema.balanceProjectorCursors)
    .where(eq(schema.balanceProjectorCursors.workerKey, "ledger_posted"));

  if (bookIds.length > 0) {
    await db
      .delete(schema.balanceEvents)
      .where(inArray(schema.balanceEvents.bookId, bookIds));
    await db
      .delete(schema.balancePositions)
      .where(inArray(schema.balancePositions.bookId, bookIds));
  }

  if (operationIds.length > 0) {
    await db
      .delete(schema.postings)
      .where(inArray(schema.postings.operationId, operationIds));
    await db
      .delete(schema.ledgerOperations)
      .where(inArray(schema.ledgerOperations.id, operationIds));
  }

  if (bookIds.length > 0) {
    await db
      .delete(schema.bookAccountInstances)
      .where(inArray(schema.bookAccountInstances.bookId, bookIds));
    await db.delete(schema.books).where(inArray(schema.books.id, bookIds));
  }

  createdOperationIds.clear();
  createdBookIds.clear();
}

function createDimensionsHash(dimensions: Record<string, string>) {
  return sha256Hex(canonicalJson(dimensions));
}

describe("balances projector integration", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  afterEach(async () => {
    await cleanupRows();
  });

  afterAll(async () => {
    await cleanupRows();
    await pool.end();
  });

  it("projects posted ledger operations exactly once into balance positions", async () => {
    const bookId = randomUUID();
    const operationId = randomUUID();
    const debitInstanceId = randomUUID();
    const creditInstanceId = randomUUID();
    const internalCounterpartyId = await resolveInternalLedgerCounterpartyId();
    const postedAt = ISOLATED_CURSOR_POSTED_AT;

    createdBookIds.add(bookId);
    createdOperationIds.add(operationId);

    await db.insert(schema.books).values({
      id: bookId,
      organizationId: internalCounterpartyId,
      code: `it-balances-${bookId}`,
      name: "Integration Balances Book",
      isDefault: false,
    });

    await db.insert(schema.bookAccountInstances).values([
      {
        id: debitInstanceId,
        bookId,
        accountNo: "1110",
        currency: "USD",
        dimensions: {
          organizationRequisiteId: "oa-destination",
        },
        dimensionsHash: createDimensionsHash({
          organizationRequisiteId: "oa-destination",
        }),
        tbLedger: 1,
        tbAccountId: 10_001n,
      },
      {
        id: creditInstanceId,
        bookId,
        accountNo: "1110",
        currency: "USD",
        dimensions: {
          organizationRequisiteId: "oa-source",
        },
        dimensionsHash: createDimensionsHash({
          organizationRequisiteId: "oa-source",
        }),
        tbLedger: 1,
        tbAccountId: 10_002n,
      },
    ]);

    await db
      .insert(schema.balanceProjectorCursors)
      .values({
        workerKey: "ledger_posted",
        lastPostedAt: postedAt,
        lastOperationId: ISOLATED_CURSOR_OPERATION_ID,
      })
      .onConflictDoUpdate({
        target: schema.balanceProjectorCursors.workerKey,
        set: {
          lastPostedAt: postedAt,
          lastOperationId: ISOLATED_CURSOR_OPERATION_ID,
        },
      });

    await db.insert(schema.ledgerOperations).values({
      id: operationId,
      sourceType: "integration/balances",
      sourceId: `source-${operationId}`,
      operationCode: "TRANSFER.POSTED",
      idempotencyKey: `idem:${operationId}`,
      payloadHash: sha256Hex(operationId),
      postingDate: new Date(postedAt.getTime() - 5_000),
      status: "posted",
      postedAt,
    });

    await db.insert(schema.postings).values({
      operationId,
      lineNo: 1,
      bookId,
      debitInstanceId,
      creditInstanceId,
      postingCode: "TR.INTRA.IMMEDIATE",
      currency: "USD",
      amountMinor: 125n,
      memo: "integration projection",
    });

    const worker = createBalancesProjectorWorkerDefinition({ db });

    await expect(runWorkerOnce(worker)).resolves.toBe(1);
    await expect(runWorkerOnce(worker)).resolves.toBe(0);

    const positions = await db
      .select({
        subjectType: schema.balancePositions.subjectType,
        subjectId: schema.balancePositions.subjectId,
        ledgerBalance: schema.balancePositions.ledgerBalance,
        available: schema.balancePositions.available,
      })
      .from(schema.balancePositions)
      .where(eq(schema.balancePositions.bookId, bookId));

    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectType: "organization_requisite",
          subjectId: "oa-destination",
          ledgerBalance: 125n,
          available: 125n,
        }),
        expect.objectContaining({
          subjectType: "organization_requisite",
          subjectId: "oa-source",
          ledgerBalance: -125n,
          available: -125n,
        }),
      ]),
    );

    const events = await db
      .select({
        subjectType: schema.balanceEvents.subjectType,
        subjectId: schema.balanceEvents.subjectId,
      })
      .from(schema.balanceEvents)
      .where(eq(schema.balanceEvents.bookId, bookId));

    expect(events).toHaveLength(2);

    const [cursor] = await db
      .select()
      .from(schema.balanceProjectorCursors)
      .where(eq(schema.balanceProjectorCursors.workerKey, "ledger_posted"))
      .limit(1);

    expect(cursor).toEqual(
      expect.objectContaining({
        lastOperationId: operationId,
      }),
    );
  });

  it("rejects inconsistent cursor rows at the database layer", async () => {
    await expect(
      db.insert(schema.balanceProjectorCursors).values({
        workerKey: "ledger_posted",
        lastPostedAt: new Date("2026-02-28T09:05:00.000Z"),
        lastOperationId: null,
      }),
    ).rejects.toThrow();
  });
});
