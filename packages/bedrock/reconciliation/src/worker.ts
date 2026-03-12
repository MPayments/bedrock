import { sql } from "drizzle-orm";

import {
  canonicalJson,
  noopLogger,
  sha256Hex,
  type Logger,
} from "@bedrock/common";
import { schema } from "@bedrock/reconciliation/schema";
import type { Database } from "@bedrock/sql/ports";
import {
  defineWorkerDescriptor,
  type BedrockWorker,
  type BedrockWorkerRunContext as WorkerRunContext,
  type BedrockWorkerRunResult as WorkerRunResult,
} from "@bedrock/workers";

import { createReconciliationService } from "./service";

export const RECONCILIATION_WORKER_DESCRIPTOR = defineWorkerDescriptor({
  id: "reconciliation",
  envKey: "RECONCILIATION_WORKER_INTERVAL_MS",
  defaultIntervalMs: 60_000,
  description: "Process pending reconciliation runs",
});

interface PendingReconciliationSource {
  source: string;
  externalRecordIds: string[];
  latestReceivedAt: Date;
  pendingRecordCount: number;
}

export interface ReconciliationWorkerSourceContext {
  source: string;
  externalRecordIds: string[];
}

type ReconciliationWorkerSourceGuard = (
  input: ReconciliationWorkerSourceContext,
) => Promise<boolean> | boolean;

async function listPendingSources(
  db: Database,
  batchSize: number,
): Promise<PendingReconciliationSource[]> {
  const result = await db.execute(sql`
    WITH pending_records AS (
      SELECT
        er.source,
        er.id,
        er.received_at
      FROM ${schema.reconciliationExternalRecords} er
      WHERE NOT EXISTS (
        SELECT 1
        FROM ${schema.reconciliationMatches} rm
        WHERE rm.external_record_id = er.id
      )
    ),
    pending_sources AS (
      SELECT
        er.source,
        array_agg(er.id::text ORDER BY er.received_at ASC, er.id ASC) AS external_record_ids,
        max(er.received_at) AS latest_received_at,
        count(*)::int AS pending_record_count
      FROM pending_records er
      GROUP BY er.source
    )
    SELECT
      source,
      external_record_ids,
      latest_received_at,
      pending_record_count
    FROM pending_sources
    ORDER BY latest_received_at ASC, source ASC
    LIMIT ${batchSize}
  `);

  return (
    (result.rows ?? []) as {
      source: string;
      external_record_ids: string[] | null;
      latest_received_at: Date | string;
      pending_record_count: number | string;
    }[]
  ).map((row) => ({
    source: row.source,
    externalRecordIds: row.external_record_ids ?? [],
    latestReceivedAt:
      row.latest_received_at instanceof Date
        ? row.latest_received_at
        : new Date(row.latest_received_at),
    pendingRecordCount:
      typeof row.pending_record_count === "number"
        ? row.pending_record_count
        : Number(row.pending_record_count),
  }));
}

function buildRunIdempotencyKey(input: {
  source: string;
  rulesetChecksum: string;
  externalRecordIds: string[];
}) {
  return sha256Hex(
    canonicalJson({
      worker: "reconciliation",
      source: input.source,
      rulesetChecksum: input.rulesetChecksum,
      externalRecordIds: input.externalRecordIds,
    }),
  );
}

export function createReconciliationWorkerDefinition(deps: {
  id?: string;
  intervalMs?: number;
  db: Database;
  logger?: Logger;
  rulesetChecksum?: string;
  beforeSource?: ReconciliationWorkerSourceGuard;
  batchSize?: number;
}): BedrockWorker {
  const { db } = deps;
  const rulesetChecksum = deps.rulesetChecksum ?? "core-default-v1";
  const beforeSource = deps.beforeSource;
  const log =
    deps.logger?.child({ svc: "reconciliation-worker" }) ?? noopLogger;
  const batchSize = deps.batchSize ?? 25;
  const reconciliation = createReconciliationService({
    db,
    logger: deps.logger,
  });

  async function runPass() {
    const pendingSources = await listPendingSources(db, batchSize);
    let processed = 0;

    for (const source of pendingSources) {
      if (beforeSource) {
        const isEnabled = await beforeSource({
          source: source.source,
          externalRecordIds: source.externalRecordIds,
        });
        if (!isEnabled) {
          continue;
        }
      }

      await reconciliation.runReconciliation({
        source: source.source,
        rulesetChecksum,
        inputQuery: {
          externalRecordIds: source.externalRecordIds,
        },
        idempotencyKey: buildRunIdempotencyKey({
          source: source.source,
          rulesetChecksum,
          externalRecordIds: source.externalRecordIds,
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

  async function runOnce(_ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass();
    return { processed };
  }

  return {
    id: deps.id ?? "reconciliation",
    intervalMs: deps.intervalMs ?? 60_000,
    runOnce,
  };
}
