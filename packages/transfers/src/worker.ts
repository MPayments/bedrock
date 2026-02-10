import { and, eq, sql } from "drizzle-orm";
import { Database } from "@repo/db";
import { schema, TransferStatus, JournalStatus } from "@repo/db/schema";
import { Logger } from "@repo/kernel";

/**
 * Finalizes internal transfer status based on the linked journal entry status:
 * approved_pending_posting -> posted/failed.
 *
 * Uses FOR UPDATE SKIP LOCKED for concurrency safety.
 */
export function createTransfersWorker(deps: { db: Database; logger?: Logger }) {
    const { db, logger } = deps;

    async function processOnce(opts?: { batchSize?: number }) {
        const batchSize = opts?.batchSize ?? 100;

        logger?.debug("Processing transfers posting batch", { batchSize });

        // Use FOR UPDATE SKIP LOCKED to prevent concurrent processing
        const rows = await db.execute<{
            transfer_id: string;
            org_id: string;
            status: string;
            ledger_entry_id: string;
            journal_status: string;
        }>(sql`
            SELECT 
                t.id as transfer_id, 
                t.org_id, 
                t.status, 
                t.ledger_entry_id, 
                j.status as journal_status
            FROM ${schema.internalTransfers} t
            JOIN ${schema.journalEntries} j ON j.id = t.ledger_entry_id
            WHERE t.status = ${TransferStatus.APPROVED_PENDING_POSTING}
            ORDER BY t.updated_at
            LIMIT ${batchSize}
            FOR UPDATE OF t SKIP LOCKED
        `);

        const items = rows.rows ?? [];
        let processed = 0;

        for (const item of items) {
            try {
                const journalStatus = item.journal_status as JournalStatus;
                
                if (journalStatus === "posted") {
                    await db
                        .update(schema.internalTransfers)
                        .set({
                            status: TransferStatus.POSTED,
                            updatedAt: sql`now()`
                        })
                        .where(and(
                            eq(schema.internalTransfers.id, item.transfer_id),
                            eq(schema.internalTransfers.status, TransferStatus.APPROVED_PENDING_POSTING),
                            eq(schema.internalTransfers.ledgerEntryId, item.ledger_entry_id)
                        ));

                    logger?.info("Transfer marked as posted", {
                        transferId: item.transfer_id,
                        orgId: item.org_id,
                        ledgerEntryId: item.ledger_entry_id,
                    });

                    processed++;
                } else if (journalStatus === "failed") {
                    await db
                        .update(schema.internalTransfers)
                        .set({
                            status: TransferStatus.FAILED,
                            updatedAt: sql`now()`
                        })
                        .where(and(
                            eq(schema.internalTransfers.id, item.transfer_id),
                            eq(schema.internalTransfers.status, TransferStatus.APPROVED_PENDING_POSTING),
                            eq(schema.internalTransfers.ledgerEntryId, item.ledger_entry_id)
                        ));

                    logger?.info("Transfer marked as failed", {
                        transferId: item.transfer_id,
                        orgId: item.org_id,
                        ledgerEntryId: item.ledger_entry_id,
                    });

                    processed++;
                }
            } catch (error) {
                logger?.error("Error processing transfer", {
                    transferId: item.transfer_id,
                    error: error instanceof Error ? error.message : String(error),
                });
                // Continue processing other items
            }
        }

        logger?.debug("Completed transfers posting batch", {
            found: items.length,
            processed,
        });

        return processed;
    }

    return {
        processOnce
    };
}
