import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { schema } from "@bedrock/ledger/schema";

import { db, tb } from "./setup";

export function randomOrgId() {
  return randomUUID();
}

export function randomIdempotencyKey() {
  return `idem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export async function getOperation(operationId: string) {
  const rows = await db
    .select()
    .from(schema.ledgerOperations)
    .where(eq(schema.ledgerOperations.id, operationId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPostings(operationId: string) {
  return db
    .select()
    .from(schema.postings)
    .where(eq(schema.postings.operationId, operationId))
    .orderBy(schema.postings.lineNo);
}

export async function getTbTransferPlans(operationId: string) {
  return db
    .select()
    .from(schema.tbTransferPlans)
    .where(eq(schema.tbTransferPlans.operationId, operationId))
    .orderBy(schema.tbTransferPlans.lineNo);
}

export async function getBookAccount(
  bookId: string,
  accountNo: string,
  tbLedger: number,
) {
  const rows = await db
    .select()
    .from(schema.bookAccountInstances)
    .where(
      and(
        eq(schema.bookAccountInstances.bookId, bookId),
        eq(schema.bookAccountInstances.accountNo, accountNo),
        eq(schema.bookAccountInstances.tbLedger, tbLedger),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
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
