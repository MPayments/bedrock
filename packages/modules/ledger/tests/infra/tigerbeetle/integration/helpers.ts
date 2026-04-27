import { and, eq } from "drizzle-orm";

import { schema } from "@bedrock/ledger/schema";

import { db, TEST_BOOK_ID, tb } from "./setup";

export function randomOrgId() {
  return TEST_BOOK_ID;
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

export { db, tb };
