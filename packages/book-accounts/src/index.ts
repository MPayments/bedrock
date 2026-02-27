import type { Transaction } from "@bedrock/db";
import { schema, type Dimensions } from "@bedrock/db/schema";
import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@bedrock/kernel";

export interface BookAccountIdentityInput {
  bookOrgId: string;
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
    input.bookOrgId,
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
      bookOrgId: input.bookOrgId,
      accountNo: input.accountNo,
      currency: input.currency,
      dimensions: input.dimensions,
      dimensionsHash,
      tbLedger,
      tbAccountId,
    })
    .onConflictDoUpdate({
      target: [
        schema.bookAccountInstances.bookOrgId,
        schema.bookAccountInstances.accountNo,
        schema.bookAccountInstances.currency,
        schema.bookAccountInstances.dimensionsHash,
      ],
      set: {
        tbLedger,
        tbAccountId,
        dimensions: input.dimensions,
      },
    })
    .returning({
      id: schema.bookAccountInstances.id,
      tbLedger: schema.bookAccountInstances.tbLedger,
      tbAccountId: schema.bookAccountInstances.tbAccountId,
    });

  const existing = inserted[0];
  if (!existing) {
    throw new Error(
      `book account instance upsert failed unexpectedly for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}`,
    );
  }

  if (existing.tbLedger !== tbLedger || existing.tbAccountId !== tbAccountId) {
    throw new Error(
      `book_account_instance invariant mismatch for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}, hash=${dimensionsHash}`,
    );
  }

  return {
    id: existing.id,
    dimensionsHash,
    tbLedger,
    tbAccountId,
  };
}
