import { createHash } from "node:crypto";

import { schema } from "@bedrock/db/schema";

const TB_ID_MAX = (1n << 128n) - 1n;
const TB_ID_MAX_ALLOWED = TB_ID_MAX - 1n;

function normalizeTbId(x: bigint): bigint {
  if (x <= 0n) return 1n;
  if (x >= TB_ID_MAX) return TB_ID_MAX_ALLOWED;
  return x;
}

function u128FromHash(input: string): bigint {
  const h = createHash("sha256").update(input).digest();
  let x = 0n;
  for (let i = 0; i < 16; i++) {
    x = (x << 8n) | BigInt(h[i]!);
  }
  return normalizeTbId(x);
}

function tbLedgerForCurrency(currency: string): number {
  const h = createHash("sha256").update(`cur:${currency}`).digest();
  const n = (h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!;
  const u = n >>> 0;
  return u === 0 ? 1 : u;
}

function stableStringify(obj: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = obj[k]!;
        return acc;
      }, {}),
  );
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function computeDimensionsHash(dimensions: Record<string, string>): string {
  return sha256Hex(stableStringify(dimensions));
}

function tbBookAccountInstanceIdFor(
  bookOrgId: string,
  accountNo: string,
  currency: string,
  dimensionsHash: string,
  tbLedger: number,
): bigint {
  return u128FromHash(
    `instance:${bookOrgId}:${accountNo}:${currency}:${dimensionsHash}:${tbLedger}`,
  );
}

interface EnsureBookAccountInstanceInput {
  bookOrgId: string;
  accountNo: string;
  currency: string;
  dimensions: Record<string, string>;
}

export async function ensureBookAccountInstanceTx(
  tx: any,
  input: EnsureBookAccountInstanceInput,
) {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);
  const tbAccountId = tbBookAccountInstanceIdFor(
    input.bookOrgId,
    input.accountNo,
    input.currency,
    dimensionsHash,
    tbLedger,
  );

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

  return existing.id;
}

