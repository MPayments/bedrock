import { and, eq } from "drizzle-orm";

import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@bedrock/ledger/ids";
import {
  makeTbAccount,
  tbCreateAccountsOrThrow,
  type TbClient,
} from "@bedrock/ledger/infra/tigerbeetle";
import { schema, type Dimensions } from "@bedrock/ledger/schema";
import type { Database } from "@bedrock/platform/persistence/drizzle";

function accountCodeFromSeed(seed: string): number {
  const normalized = seed.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
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
    throw new Error(
      `TB account mapping mismatch for book=${bookId}, key=${key}, tbLedger=${tbLedger}`,
    );
  }
}

export async function resolveTbBookAccountInstanceId(
  input: ResolveTbBookAccountInstanceParams,
): Promise<bigint> {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);
  const expected = tbBookAccountInstanceIdFor(
    input.bookId,
    input.accountNo,
    input.currency,
    dimensionsHash,
    tbLedger,
  );

  const [existing] = await input.db
    .select({ tbAccountId: schema.bookAccountInstances.tbAccountId })
    .from(schema.bookAccountInstances)
    .where(
      and(
        eq(schema.bookAccountInstances.bookId, input.bookId),
        eq(schema.bookAccountInstances.accountNo, input.accountNo),
        eq(schema.bookAccountInstances.currency, input.currency),
        eq(schema.bookAccountInstances.dimensionsHash, dimensionsHash),
      ),
    )
    .limit(1);

  if (!existing) {
    await input.db
      .insert(schema.bookAccountInstances)
      .values({
        bookId: input.bookId,
        accountNo: input.accountNo,
        currency: input.currency,
        dimensions: input.dimensions,
        dimensionsHash,
        tbLedger,
        tbAccountId: expected,
      })
      .onConflictDoNothing();
  } else {
    assertAccountMapping(
      existing.tbAccountId,
      expected,
      input.bookId,
      input.accountNo,
      tbLedger,
    );
  }

  await tbCreateAccountsOrThrow(input.tb, [
    makeTbAccount(expected, tbLedger, accountCodeFromSeed(input.accountNo), 0),
  ]);

  return expected;
}
