import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as reconciliationSchema } from "@bedrock/reconciliation/schema";

import { createReconciliationService } from "../../src/service";
import { createReconciliationWorkerDefinition } from "../../src/worker";

const schema = {
  ...reconciliationSchema,
  ...ledgerSchema,
};

async function runWorkerOnce(
  worker: ReturnType<typeof createReconciliationWorkerDefinition>,
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
const createdOperationIds = new Set<string>();
const createdSources = new Set<string>();

async function cleanupRows() {
  for (const source of createdSources) {
    await pool.query(
      `
        DELETE FROM reconciliation_exceptions
        WHERE run_id IN (
          SELECT id FROM reconciliation_runs WHERE source = $1
        )
      `,
      [source],
    );
    await pool.query(
      `
        DELETE FROM reconciliation_matches
        WHERE run_id IN (
          SELECT id FROM reconciliation_runs WHERE source = $1
        )
      `,
      [source],
    );
    await pool.query("DELETE FROM reconciliation_runs WHERE source = $1", [
      source,
    ]);
    await pool.query(
      "DELETE FROM reconciliation_external_records WHERE source = $1",
      [source],
    );
  }

  const operationIds = Array.from(createdOperationIds);
  if (operationIds.length > 0) {
    await db
      .delete(schema.ledgerOperations)
      .where(inArray(schema.ledgerOperations.id, operationIds));
  }

  createdOperationIds.clear();
  createdSources.clear();
}

describe("reconciliation worker integration", () => {
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

  it("creates deterministic runs, matches, and exceptions from pending external records", async () => {
    const matchedOperationId = randomUUID();
    const source = `recon-it-${randomUUID()}`;

    createdOperationIds.add(matchedOperationId);
    createdSources.add(source);

    await db.insert(schema.ledgerOperations).values({
      id: matchedOperationId,
      sourceType: "integration/reconciliation",
      sourceId: `source-${matchedOperationId}`,
      operationCode: "PAYMENT.POSTED",
      idempotencyKey: `idem:${matchedOperationId}`,
      payloadHash: matchedOperationId,
      postingDate: new Date("2026-02-28T08:00:00.000Z"),
      status: "posted",
      postedAt: new Date("2026-02-28T08:05:00.000Z"),
    });

    const reconciliation = createReconciliationService({ db });

    await reconciliation.ingestExternalRecord({
      source,
      sourceRecordId: "matched-record",
      rawPayload: { amountMinor: 100 },
      normalizedPayload: { operationId: matchedOperationId },
      normalizationVersion: 1,
      idempotencyKey: `ingest:${source}:matched`,
    });

    await reconciliation.ingestExternalRecord({
      source,
      sourceRecordId: "unmatched-record",
      rawPayload: { amountMinor: 200 },
      normalizedPayload: { operationId: randomUUID() },
      normalizationVersion: 1,
      idempotencyKey: `ingest:${source}:unmatched`,
    });

    const worker = createReconciliationWorkerDefinition({
      db,
      rulesetChecksum: "core-default-v1",
    });

    await expect(runWorkerOnce(worker)).resolves.toBe(1);
    await expect(runWorkerOnce(worker)).resolves.toBe(0);

    const runs = await db
      .select()
      .from(schema.reconciliationRuns)
      .where(eq(schema.reconciliationRuns.source, source));

    expect(runs).toHaveLength(1);

    const matches = await db
      .select({
        status: schema.reconciliationMatches.status,
        matchedOperationId: schema.reconciliationMatches.matchedOperationId,
      })
      .from(schema.reconciliationMatches)
      .where(eq(schema.reconciliationMatches.runId, runs[0]!.id));

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "matched",
          matchedOperationId,
        }),
        expect.objectContaining({
          status: "unmatched",
          matchedOperationId: null,
        }),
      ]),
    );

    const exceptions = await db
      .select({
        reasonCode: schema.reconciliationExceptions.reasonCode,
        state: schema.reconciliationExceptions.state,
      })
      .from(schema.reconciliationExceptions)
      .where(eq(schema.reconciliationExceptions.runId, runs[0]!.id));

    expect(exceptions).toEqual([
      expect.objectContaining({
        reasonCode: "no_match",
        state: "open",
      }),
    ]);

    const secondMatchedOperationId = randomUUID();
    createdOperationIds.add(secondMatchedOperationId);

    await db.insert(schema.ledgerOperations).values({
      id: secondMatchedOperationId,
      sourceType: "integration/reconciliation",
      sourceId: `source-${secondMatchedOperationId}`,
      operationCode: "PAYMENT.POSTED",
      idempotencyKey: `idem:${secondMatchedOperationId}`,
      payloadHash: secondMatchedOperationId,
      postingDate: new Date("2026-02-28T08:10:00.000Z"),
      status: "posted",
      postedAt: new Date("2026-02-28T08:15:00.000Z"),
    });

    await reconciliation.ingestExternalRecord({
      source,
      sourceRecordId: "matched-record-2",
      rawPayload: { amountMinor: 300 },
      normalizedPayload: { operationId: secondMatchedOperationId },
      normalizationVersion: 1,
      idempotencyKey: `ingest:${source}:matched-2`,
    });

    await expect(runWorkerOnce(worker)).resolves.toBe(1);
    await expect(runWorkerOnce(worker)).resolves.toBe(0);

    const allRuns = await db
      .select()
      .from(schema.reconciliationRuns)
      .where(eq(schema.reconciliationRuns.source, source));

    expect(allRuns).toHaveLength(2);
    expect(allRuns[1]?.resultSummary).toEqual({
      total: 1,
      matched: 1,
      unmatched: 0,
      ambiguous: 0,
    });

    const allMatches = await db
      .select({
        runId: schema.reconciliationMatches.runId,
        externalRecordId: schema.reconciliationMatches.externalRecordId,
        status: schema.reconciliationMatches.status,
      })
      .from(schema.reconciliationMatches)
      .innerJoin(
        schema.reconciliationRuns,
        eq(schema.reconciliationMatches.runId, schema.reconciliationRuns.id),
      )
      .where(eq(schema.reconciliationRuns.source, source));

    expect(allMatches).toHaveLength(3);
    expect(
      allMatches.filter((match) => match.status === "unmatched"),
    ).toHaveLength(1);

    const allExceptions = await db
      .select({
        id: schema.reconciliationExceptions.id,
        reasonCode: schema.reconciliationExceptions.reasonCode,
      })
      .from(schema.reconciliationExceptions)
      .innerJoin(
        schema.reconciliationRuns,
        eq(schema.reconciliationExceptions.runId, schema.reconciliationRuns.id),
      )
      .where(eq(schema.reconciliationRuns.source, source));

    expect(allExceptions).toEqual([
      expect.objectContaining({
        reasonCode: "no_match",
      }),
    ]);
  });
});
