import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { schema } from "@bedrock/db/schema/balances";
import { canonicalJson, sha256Hex } from "@bedrock/foundation/kernel";

import { createBalancesProjectorWorkerDefinition } from "../../../src/balances/worker";

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
    const [latestPostedOperation] = await db
      .select({
        id: schema.ledgerOperations.id,
        postedAt: schema.ledgerOperations.postedAt,
      })
      .from(schema.ledgerOperations)
      .where(eq(schema.ledgerOperations.status, "posted"))
      .orderBy(
        desc(schema.ledgerOperations.postedAt),
        desc(schema.ledgerOperations.id),
      )
      .limit(1);
    const postedAt = latestPostedOperation?.postedAt
      ? new Date(latestPostedOperation.postedAt.getTime() + 1_000)
      : new Date("2026-02-28T09:05:00.000Z");

    createdBookIds.add(bookId);
    createdOperationIds.add(operationId);

    await db.insert(schema.books).values({
      id: bookId,
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
          operationalAccountId: "oa-destination",
        },
        dimensionsHash: createDimensionsHash({
          operationalAccountId: "oa-destination",
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
          operationalAccountId: "oa-source",
        },
        dimensionsHash: createDimensionsHash({
          operationalAccountId: "oa-source",
        }),
        tbLedger: 1,
        tbAccountId: 10_002n,
      },
    ]);

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

    if (latestPostedOperation?.postedAt) {
      await db.insert(schema.balanceProjectorCursors).values({
        workerKey: "ledger_posted",
        lastPostedAt: latestPostedOperation.postedAt,
        lastOperationId: latestPostedOperation.id,
      }).onConflictDoUpdate({
        target: schema.balanceProjectorCursors.workerKey,
        set: {
          lastPostedAt: latestPostedOperation.postedAt,
          lastOperationId: latestPostedOperation.id,
        },
      });
    }

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
          subjectType: "operational_account",
          subjectId: "oa-destination",
          ledgerBalance: 125n,
          available: 125n,
        }),
        expect.objectContaining({
          subjectType: "operational_account",
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
