import { sql } from "drizzle-orm";
import { schema } from "@repo/db/schema";

const FINALIZE: Record<string, string> = {
  funding_settled_pending_posting: "funding_settled",
  fx_executed_pending_posting: "fx_executed",
  payout_initiated_pending_posting: "payout_initiated",
  closed_pending_posting: "closed",
  failed_pending_posting: "failed"
};

export function createPaymentsPostingWorker(deps: { db: any; treasuryOrgId?: string }) {
  const { db, treasuryOrgId } = deps;

  async function processPendingPostingOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 50;

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

    for (const it of items) {
      const target = FINALIZE[it.order_status];
      if (!target) continue;

      if (it.journal_status === "posted") {
        await db.execute(sql`
          UPDATE ${schema.paymentOrders}
          SET status = ${target}, updated_at = now()
          WHERE id = ${it.order_id}
            AND status = ${it.order_status}
            AND ledger_entry_id = ${it.ledger_entry_id}
        `);
      }

      if (it.journal_status === "failed") {
        await db.execute(sql`
          UPDATE ${schema.paymentOrders}
          SET status = 'failed', updated_at = now()
          WHERE id = ${it.order_id}
            AND status = ${it.order_status}
            AND ledger_entry_id = ${it.ledger_entry_id}
        `);
      }
    }

    return items.length;
  }

  return { processPendingPostingOnce };
}
