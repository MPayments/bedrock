import { sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import type { ReconciliationPendingSourcesPort } from "../../../application/exceptions/ports";
import { schema } from "../schema";

export function createDrizzlePendingSourcesQuerySupport(input: {
  db: Database;
}): ReconciliationPendingSourcesPort {
  const { db } = input;

  return {
    async listPendingSources(batchSize) {
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
    },
  };
}
