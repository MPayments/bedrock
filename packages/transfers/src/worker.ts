import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@bedrock/db";
import {
  schema,
  type LedgerOperationStatus,
  type TransferStatus,
} from "@bedrock/db/schema";
import type { Logger } from "@bedrock/kernel";

type ClaimableStatus =
  | "approved_pending_posting"
  | "settle_pending_posting"
  | "void_pending_posting";

const CLAIMABLE_STATUSES: readonly ClaimableStatus[] = [
  "approved_pending_posting",
  "settle_pending_posting",
  "void_pending_posting",
];

function resolvePostedStatus(
  status: ClaimableStatus,
  settlementMode: "immediate" | "pending",
): TransferStatus {
  if (status === "approved_pending_posting") {
    return settlementMode === "pending" ? "pending" : "posted";
  }

  if (status === "settle_pending_posting") {
    return "posted";
  }

  return "voided";
}

export function createTransfersWorker(deps: { db: Database; logger?: Logger }) {
  const { db, logger } = deps;

  async function processOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 100;

    const rows = await db.execute<{
      transfer_id: string;
      status: ClaimableStatus;
      settlement_mode: "immediate" | "pending";
      ledger_operation_id: string;
      journal_status: LedgerOperationStatus;
      journal_error: string | null;
    }>(sql`
            SELECT
                t.id AS transfer_id,
                t.status,
                t.settlement_mode,
                t.ledger_operation_id,
                j.status AS journal_status,
                j.error AS journal_error
            FROM ${schema.transferOrders} t
            JOIN ${schema.ledgerOperations} j ON j.id = t.ledger_operation_id
            WHERE t.status IN (${sql.join(
              CLAIMABLE_STATUSES.map((status) => sql`${status}`),
              sql`, `,
            )})
            ORDER BY t.updated_at
            LIMIT ${batchSize}
            FOR UPDATE OF t SKIP LOCKED
        `);

    let processed = 0;
    for (const row of rows.rows ?? []) {
      try {
        let nextStatus: TransferStatus | null = null;
        let lastError: string | null = null;

        if (row.journal_status === "posted") {
          nextStatus = resolvePostedStatus(row.status, row.settlement_mode);
        } else if (row.journal_status === "failed") {
          nextStatus = "failed";
          lastError = row.journal_error ?? "Ledger journal posting failed";
        }

        if (!nextStatus) continue;

        await db
          .update(schema.transferOrders)
          .set({
            status: nextStatus,
            lastError,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(schema.transferOrders.id, row.transfer_id),
              eq(schema.transferOrders.status, row.status),
              eq(
                schema.transferOrders.ledgerOperationId,
                row.ledger_operation_id,
              ),
            ),
          );

        processed += 1;
      } catch (error) {
        logger?.error("Error processing transfer posting state", {
          transferId: row.transfer_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger?.debug("Processed transfer posting batch", {
      found: rows.rows?.length ?? 0,
      processed,
    });

    return processed;
  }

  return {
    processOnce,
  };
}
