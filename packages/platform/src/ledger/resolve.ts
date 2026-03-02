import { and, eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema/ledger";
import type { Dimensions } from "@bedrock/db/schema/ledger";
import type { Database } from "@bedrock/db/types";
import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@bedrock/foundation/kernel";

import { AccountMappingConflictError } from "./errors";
import { makeTbAccount, tbCreateAccountsOrThrow, type TbClient } from "./tb";

function accountCodeFromSeed(seed: string): number {
  const normalized = seed.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return (hash % 65535) + 1;
}

interface ResolveTbBookAccountInstanceParams {
  db: Database;
  tb: TbClient;
  bookId: string;
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

function assertAccountMapping(
  actual: bigint,
  expected: bigint,
  bookId: string,
  key: string,
  tbLedger: number,
) {
  if (actual !== expected) {
    throw new AccountMappingConflictError(
      `TB account mapping mismatch for book=${bookId}, key=${key}, tbLedger=${tbLedger}`,
      bookId,
      tbLedger,
      key,
      expected,
      actual,
    );
  }
}

export async function resolveTbBookAccountInstanceId(
  p: ResolveTbBookAccountInstanceParams,
): Promise<bigint> {
  const dimensionsHash = computeDimensionsHash(p.dimensions);
  const tbLedger = tbLedgerForCurrency(p.currency);
  const expected = tbBookAccountInstanceIdFor(
    p.bookId,
    p.accountNo,
    p.currency,
    dimensionsHash,
    tbLedger,
  );

  const [existing] = await p.db
    .select({ tbAccountId: schema.bookAccountInstances.tbAccountId })
    .from(schema.bookAccountInstances)
    .where(
      and(
        eq(schema.bookAccountInstances.bookId, p.bookId),
        eq(schema.bookAccountInstances.accountNo, p.accountNo),
        eq(schema.bookAccountInstances.currency, p.currency),
        eq(schema.bookAccountInstances.dimensionsHash, dimensionsHash),
      ),
    )
    .limit(1);

  if (!existing) {
    await p.db
      .insert(schema.bookAccountInstances)
      .values({
        bookId: p.bookId,
        accountNo: p.accountNo,
        currency: p.currency,
        dimensions: p.dimensions,
        dimensionsHash,
        tbLedger,
        tbAccountId: expected,
      })
      .onConflictDoNothing();
  } else {
    assertAccountMapping(
      existing.tbAccountId,
      expected,
      p.bookId,
      p.accountNo,
      tbLedger,
    );
  }

  await tbCreateAccountsOrThrow(p.tb, [
    makeTbAccount(expected, tbLedger, accountCodeFromSeed(p.accountNo), 0),
  ]);

  return expected;
}
