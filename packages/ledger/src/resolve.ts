import { and, eq } from "drizzle-orm";

import { type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";

import { AccountMappingConflictError } from "./errors";
import { tbBookAccountIdFor, tbLedgerForCurrency } from "./ids";
import { makeTbAccount, tbCreateAccountsOrThrow, type TbClient } from "./tb";

interface ResolveTbBookAccountIdParams {
  db: Database;
  tb: TbClient;
  orgId: string;
  accountNo: string;
  currency: string;
}

function accountCodeFromSeed(seed: string): number {
  const normalized = seed.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return (hash % 65535) + 1;
}

function assertAccountMapping(
  actual: bigint,
  expected: bigint,
  orgId: string,
  key: string,
  tbLedger: number,
) {
  if (actual !== expected) {
    throw new AccountMappingConflictError(
      `TB account mapping mismatch for org=${orgId}, key=${key}, tbLedger=${tbLedger}`,
      orgId,
      tbLedger,
      key,
      expected,
      actual,
    );
  }
}

export async function resolveTbBookAccountId(
  p: ResolveTbBookAccountIdParams,
): Promise<bigint> {
  const tbLedger = tbLedgerForCurrency(p.currency);
  const expected = tbBookAccountIdFor(p.orgId, p.accountNo, p.currency, tbLedger);

  const [existing] = await p.db
    .select({ tbAccountId: schema.bookAccounts.tbAccountId })
    .from(schema.bookAccounts)
    .where(
      and(
        eq(schema.bookAccounts.orgId, p.orgId),
        eq(schema.bookAccounts.accountNo, p.accountNo),
        eq(schema.bookAccounts.currency, p.currency),
      ),
    )
    .limit(1);

  if (!existing) {
    await p.db
      .insert(schema.bookAccounts)
      .values({
        orgId: p.orgId,
        accountNo: p.accountNo,
        currency: p.currency,
        tbLedger,
        tbAccountId: expected,
      })
      .onConflictDoNothing();
  } else {
    assertAccountMapping(
      existing.tbAccountId,
      expected,
      p.orgId,
      p.accountNo,
      tbLedger,
    );
  }

  await tbCreateAccountsOrThrow(
    p.tb,
    [makeTbAccount(expected, tbLedger, accountCodeFromSeed(p.accountNo), 0)],
  );

  return expected;
}
