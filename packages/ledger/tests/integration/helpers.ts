import { db, tb } from "./setup";
import { schema } from "@repo/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export function randomOrgId() {
  return randomUUID();
}

export function randomIdempotencyKey() {
  return `idem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export async function waitForOutboxProcessing(
  journalEntryId: string,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const outboxEntry = await db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.refId, journalEntryId))
      .limit(1);

    if (outboxEntry.length > 0 && outboxEntry[0].status === "done") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Outbox processing timed out for entry ${journalEntryId}`);
}

export async function getJournalEntry(entryId: string) {
  const entries = await db
    .select()
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.id, entryId))
    .limit(1);

  return entries[0] || null;
}

export async function getJournalLines(entryId: string) {
  return await db
    .select()
    .from(schema.journalLines)
    .where(eq(schema.journalLines.entryId, entryId));
}

export async function getTbTransferPlans(entryId: string) {
  return await db
    .select()
    .from(schema.tbTransferPlans)
    .where(eq(schema.tbTransferPlans.journalEntryId, entryId));
}

export async function getLedgerAccount(orgId: string, key: string, tbLedger: number) {
  const accounts = await db
    .select()
    .from(schema.ledgerAccounts)
    .where(and(
      eq(schema.ledgerAccounts.orgId, orgId),
      eq(schema.ledgerAccounts.key, key),
      eq(schema.ledgerAccounts.tbLedger, tbLedger)
    ))
    .limit(1);

  return accounts[0] || null;
}

export async function getTbAccount(accountId: bigint) {
  const accounts = await tb.lookupAccounts([accountId]);
  return accounts[0] || null;
}

export async function getTbTransfer(transferId: bigint) {
  const transfers = await tb.lookupTransfers([transferId]);
  return transfers[0] || null;
}

export { db, tb };
