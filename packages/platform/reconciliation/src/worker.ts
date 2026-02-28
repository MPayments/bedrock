import { sql } from "drizzle-orm";

import type { Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { canonicalJson, noopLogger, sha256Hex, type Logger } from "@bedrock/kernel";

import { createReconciliationService } from "./service";

interface PendingReconciliationSource {
  source: string;
  latestReceivedAt: Date;
  latestRecordId: string;
  pendingRecordCount: number;
}

async function listPendingSources(
  db: Database,
  batchSize: number,
): Promise<PendingReconciliationSource[]> {
  const result = await db.execute(sql`
    WITH latest_runs AS (
      SELECT
        source,
        max(created_at) AS last_run_at
      FROM ${schema.reconciliationRuns}
      GROUP BY source
    ),
    pending_sources AS (
      SELECT
        er.source,
        max(er.received_at) AS latest_received_at,
        max(er.id::text) AS latest_record_id,
        count(*)::int AS pending_record_count
      FROM ${schema.reconciliationExternalRecords} er
      LEFT JOIN latest_runs lr
        ON lr.source = er.source
      WHERE lr.last_run_at IS NULL OR er.received_at > lr.last_run_at
      GROUP BY er.source
    )
    SELECT
      source,
      latest_received_at,
      latest_record_id,
      pending_record_count
    FROM pending_sources
    ORDER BY latest_received_at ASC, source ASC
    LIMIT ${batchSize}
  `);

  return ((result.rows ?? []) as Array<{
    source: string;
    latest_received_at: Date | string;
    latest_record_id: string;
    pending_record_count: number | string;
  }>).map((row) => ({
    source: row.source,
    latestReceivedAt:
      row.latest_received_at instanceof Date
        ? row.latest_received_at
        : new Date(row.latest_received_at),
    latestRecordId: row.latest_record_id,
    pendingRecordCount:
      typeof row.pending_record_count === "number"
        ? row.pending_record_count
        : Number(row.pending_record_count),
  }));
}

function buildRunIdempotencyKey(input: {
  source: string;
  rulesetChecksum: string;
  latestReceivedAt: Date;
  latestRecordId: string;
  pendingRecordCount: number;
}) {
  return sha256Hex(
    canonicalJson({
      worker: "reconciliation",
      source: input.source,
      rulesetChecksum: input.rulesetChecksum,
      latestReceivedAt: input.latestReceivedAt.toISOString(),
      latestRecordId: input.latestRecordId,
      pendingRecordCount: input.pendingRecordCount,
    }),
  );
}

export function createReconciliationWorker(deps: {
  db: Database;
  logger?: Logger;
  rulesetChecksum?: string;
}) {
  const { db } = deps;
  const rulesetChecksum = deps.rulesetChecksum ?? "core-default-v1";
  const log = deps.logger?.child({ svc: "reconciliation-worker" }) ?? noopLogger;
  const reconciliation = createReconciliationService({
    db,
    logger: deps.logger,
  });

  async function processOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 25;
    const pendingSources = await listPendingSources(db, batchSize);
    let processed = 0;

    for (const source of pendingSources) {
      await reconciliation.runReconciliation({
        source: source.source,
        rulesetChecksum,
        inputQuery: {},
        idempotencyKey: buildRunIdempotencyKey({
          source: source.source,
          rulesetChecksum,
          latestReceivedAt: source.latestReceivedAt,
          latestRecordId: source.latestRecordId,
          pendingRecordCount: source.pendingRecordCount,
        }),
      });
      processed += 1;
    }

    if (processed > 0) {
      log.info("Processed reconciliation runs", {
        processed,
        rulesetChecksum,
      });
    }

    return processed;
  }

  return {
    processOnce,
  };
}
