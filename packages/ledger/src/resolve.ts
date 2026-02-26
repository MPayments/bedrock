import { and, eq } from "drizzle-orm";

import { type Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import type { Dimensions } from "@bedrock/db/schema";
import { sha256Hex, stableStringify } from "@bedrock/kernel";

import { AccountMappingConflictError } from "./errors";
import { tbBookAccountInstanceIdFor, tbLedgerForCurrency } from "./ids";
import { makeTbAccount, tbCreateAccountsOrThrow, type TbClient } from "./tb";

function accountCodeFromSeed(seed: string): number {
  const normalized = seed.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return (hash % 65535) + 1;
}

function computeDimensionsHash(dimensions: Dimensions): string {
  const sorted = Object.keys(dimensions)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = dimensions[key]!;
      return acc;
    }, {});
  return sha256Hex(stableStringify(sorted));
}

interface ResolveTbBookAccountInstanceParams {
  db: Database;
  tb: TbClient;
  bookOrgId: string;
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

function assertAccountMapping(
  actual: bigint,
  expected: bigint,
  bookOrgId: string,
  key: string,
  tbLedger: number,
) {
  if (actual !== expected) {
    throw new AccountMappingConflictError(
      `TB account mapping mismatch for org=${bookOrgId}, key=${key}, tbLedger=${tbLedger}`,
      bookOrgId,
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
    p.bookOrgId,
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
        eq(schema.bookAccountInstances.bookOrgId, p.bookOrgId),
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
        bookOrgId: p.bookOrgId,
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
      p.bookOrgId,
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
