import { and, eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/kernel/db/types";
import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@bedrock/kernel";
import { schema, type Dimensions } from "@bedrock/core/ledger/schema";

export interface BookAccountIdentityInput {
  bookId: string;
  accountNo: string;
  currency: string;
  dimensions: Dimensions;
}

export interface BookAccountIdentity {
  dimensionsHash: string;
  tbLedger: number;
  tbAccountId: bigint;
}

export interface BookAccountInstanceRef extends BookAccountIdentity {
  id: string;
}

export function computeBookAccountIdentity(
  input: BookAccountIdentityInput,
): BookAccountIdentity {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);
  const tbAccountId = tbBookAccountInstanceIdFor(
    input.bookId,
    input.accountNo,
    input.currency,
    dimensionsHash,
    tbLedger,
  );

  return {
    dimensionsHash,
    tbLedger,
    tbAccountId,
  };
}

export async function ensureBookAccountInstanceTx(
  tx: Transaction,
  input: BookAccountIdentityInput,
): Promise<BookAccountInstanceRef> {
  const { dimensionsHash, tbLedger, tbAccountId } =
    computeBookAccountIdentity(input);

  const inserted = await tx
    .insert(schema.bookAccountInstances)
    .values({
      bookId: input.bookId,
      accountNo: input.accountNo,
      currency: input.currency,
      dimensions: input.dimensions,
      dimensionsHash,
      tbLedger,
      tbAccountId,
    })
    .onConflictDoNothing()
    .returning({
      id: schema.bookAccountInstances.id,
      tbLedger: schema.bookAccountInstances.tbLedger,
      tbAccountId: schema.bookAccountInstances.tbAccountId,
    });

  if (inserted[0]) {
    return {
      id: inserted[0].id,
      dimensionsHash,
      tbLedger,
      tbAccountId,
    };
  }

  const [existing] = await tx
    .select({
      id: schema.bookAccountInstances.id,
      tbLedger: schema.bookAccountInstances.tbLedger,
      tbAccountId: schema.bookAccountInstances.tbAccountId,
    })
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
    throw new Error(
      `book account instance insert/select failed unexpectedly for book=${input.bookId}, accountNo=${input.accountNo}, currency=${input.currency}`,
    );
  }

  if (existing.tbLedger !== tbLedger || existing.tbAccountId !== tbAccountId) {
    throw new Error(
      `book_account_instance invariant mismatch for book=${input.bookId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
    );
  }

  return {
    id: existing.id,
    dimensionsHash,
    tbLedger,
    tbAccountId,
  };
}
