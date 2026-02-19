import { sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";

import { OrderFinalizeFromPendingPosting } from "./state-machine";

const FeePaymentOrderFinalizeFromPendingPosting: Readonly<Record<string, string>> = {
    initiated_pending_posting: "initiated",
    settled_pending_posting: "settled",
    voided_pending_posting: "voided",
};

export function createTreasuryWorker(deps: { db: Database }) {
    const { db } = deps;

    async function processPaymentOrders(batchSize: number): Promise<number> {
        const rows = await db.execute(sql`
      SELECT o.id as order_id, o.status as order_status, o.ledger_entry_id as ledger_entry_id, j.status as journal_status
      FROM ${schema.paymentOrders} o
      JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
      WHERE o.ledger_entry_id IS NOT NULL
        AND o.status LIKE '%_pending_posting'
      ORDER BY o.updated_at
      LIMIT ${batchSize}
    `);

        const items = (rows.rows ?? []) as {
            order_id: string;
            order_status: string;
            ledger_entry_id: string;
            journal_status: string;
        }[];

        let processed = 0;

        for (const it of items) {
            const target = OrderFinalizeFromPendingPosting[it.order_status];
            if (!target) continue;

            await db.transaction(async (tx: Transaction) => {
                const locked = await tx.execute(sql`
          SELECT o.id, o.status, j.status as journal_status
          FROM ${schema.paymentOrders} o
          JOIN ${schema.journalEntries} j ON j.id = o.ledger_entry_id
          WHERE o.id = ${it.order_id}
            AND o.status = ${it.order_status}
            AND o.ledger_entry_id = ${it.ledger_entry_id}
          FOR UPDATE OF o SKIP LOCKED
        `);

                const lockedRows = (locked.rows ?? []) as {
                    id: string;
                    status: string;
                    journal_status: string;
                }[];

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

    async function processFeePaymentOrders(batchSize: number): Promise<number> {
        const rows = await db.execute(sql`
      SELECT
        f.id as fee_payment_order_id,
        f.status as fee_status,
        CASE
          WHEN f.status = 'initiated_pending_posting' THEN f.initiate_entry_id
          ELSE f.resolve_entry_id
        END as ledger_entry_id,
        j.status as journal_status
      FROM ${schema.feePaymentOrders} f
      JOIN ${schema.journalEntries} j ON j.id = (
        CASE
          WHEN f.status = 'initiated_pending_posting' THEN f.initiate_entry_id
          ELSE f.resolve_entry_id
        END
      )
      WHERE f.status IN ('initiated_pending_posting', 'settled_pending_posting', 'voided_pending_posting')
      ORDER BY f.updated_at
      LIMIT ${batchSize}
    `);

        const items = (rows.rows ?? []) as {
            fee_payment_order_id: string;
            fee_status: string;
            ledger_entry_id: string;
            journal_status: string;
        }[];

        let processed = 0;

        for (const it of items) {
            const target = FeePaymentOrderFinalizeFromPendingPosting[it.fee_status];
            if (!target) continue;

            await db.transaction(async (tx: Transaction) => {
                const locked = await tx.execute(sql`
          SELECT
            f.id,
            f.status,
            CASE
              WHEN f.status = 'initiated_pending_posting' THEN f.initiate_entry_id
              ELSE f.resolve_entry_id
            END as ledger_entry_id,
            j.status as journal_status
          FROM ${schema.feePaymentOrders} f
          JOIN ${schema.journalEntries} j ON j.id = (
            CASE
              WHEN f.status = 'initiated_pending_posting' THEN f.initiate_entry_id
              ELSE f.resolve_entry_id
            END
          )
          WHERE f.id = ${it.fee_payment_order_id}
            AND f.status = ${it.fee_status}
          FOR UPDATE OF f SKIP LOCKED
        `);

                const lockedRows = (locked.rows ?? []) as {
                    id: string;
                    status: string;
                    ledger_entry_id: string;
                    journal_status: string;
                }[];

                if (!lockedRows.length) return;

                const currentJournalStatus = lockedRows[0]!.journal_status;

                if (currentJournalStatus === "posted") {
                    await tx.execute(sql`
            UPDATE ${schema.feePaymentOrders}
            SET status = ${target}, updated_at = now()
            WHERE id = ${it.fee_payment_order_id}
              AND status = ${it.fee_status}
          `);
                    processed++;
                } else if (currentJournalStatus === "failed") {
                    await tx.execute(sql`
            UPDATE ${schema.feePaymentOrders}
            SET status = 'failed', updated_at = now()
            WHERE id = ${it.fee_payment_order_id}
              AND status = ${it.fee_status}
          `);
                    processed++;
                }
            });
        }

        return processed;
    }

    async function processOnce(opts?: { batchSize?: number }) {
        const batchSize = opts?.batchSize ?? 50;
        const processedOrders = await processPaymentOrders(batchSize);
        const processedFeeOrders = await processFeePaymentOrders(batchSize);
        return processedOrders + processedFeeOrders;
    }

    return { processOnce };
}
