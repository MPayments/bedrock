import { sql } from "drizzle-orm";
import { schema } from "@repo/db/schema";
import { Database } from "@repo/db";
import { OrderFinalizeFromPendingPosting } from "./state-machine";

export function createTreasuryWorker(deps: { db: Database; treasuryOrgId?: string }) {
  const { db, treasuryOrgId } = deps;

  async function processOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 50;

    // Process each order in its own transaction with FOR UPDATE SKIP LOCKED
    // to prevent race conditions between multiple workers
    const rows = await db.execute(sql`
      SELECT o.id as order_id, o.status as order_status, o.ledger_entry_id as ledger_entry_id, j.status as journal_status
      FROM ${schema.paymentOrders} o
      JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
      WHERE o.ledger_entry_id IS NOT NULL
        AND o.status LIKE '%_pending_posting'
        ${treasuryOrgId ? sql`AND o.treasury_org_id = ${treasuryOrgId}` : sql``}
      ORDER BY o.updated_at
      LIMIT ${batchSize}
    `);

    const items = (rows.rows ?? []) as Array<{
      order_id: string;
      order_status: string;
      ledger_entry_id: string;
      journal_status: string;
    }>;

    let processed = 0;

    for (const it of items) {
      const target = OrderFinalizeFromPendingPosting[it.order_status];
      if (!target) continue;

      // Use a transaction with FOR UPDATE SKIP LOCKED to prevent race conditions
      await db.transaction(async (tx: any) => {
        // Re-fetch and lock the order row to prevent concurrent updates
        const locked = await tx.execute(sql`
          SELECT o.id, o.status, j.status as journal_status
          FROM ${schema.paymentOrders} o
          JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
          WHERE o.id = ${it.order_id}
            AND o.status = ${it.order_status}
            AND o.ledger_entry_id = ${it.ledger_entry_id}
          FOR UPDATE OF o SKIP LOCKED
        `);

        const lockedRows = (locked.rows ?? []) as Array<{
          id: string;
          status: string;
          journal_status: string;
        }>;

        // If no rows returned, another worker is processing or already processed
        if (!lockedRows.length) return;

        const currentJournalStatus = lockedRows[0]!.journal_status;

        if (currentJournalStatus === "posted") {
          await tx.execute(sql`
            UPDATE ${schema.paymentOrders}
            SET status = ${target}, updated_at = now()
            WHERE id = ${it.order_id}
              AND status = ${it.order_status}
              AND ledger_entry_id = ${it.ledger_entry_id}
          `);
          processed++;
        } else if (currentJournalStatus === "failed") {
          await tx.execute(sql`
            UPDATE ${schema.paymentOrders}
            SET status = 'failed', updated_at = now()
            WHERE id = ${it.order_id}
              AND status = ${it.order_status}
              AND ledger_entry_id = ${it.ledger_entry_id}
          `);
          processed++;
        }
      });
    }

    return processed;
  }

  return { processOnce };
}
