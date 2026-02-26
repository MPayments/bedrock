import { and, eq } from "drizzle-orm";
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
    .onConflictDoNothing()
    .returning({ id: schema.bookAccountInstances.id });

  if (inserted.length > 0) {
    return inserted[0]!.id;
  }

  const [existing] = await tx
    .select({ id: schema.bookAccountInstances.id })
    .from(schema.bookAccountInstances)
    .where(
      and(
        eq(schema.bookAccountInstances.bookOrgId, input.bookOrgId),
        eq(schema.bookAccountInstances.accountNo, input.accountNo),
        eq(schema.bookAccountInstances.currency, input.currency),
        eq(schema.bookAccountInstances.dimensionsHash, dimensionsHash),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(
      `Failed to resolve book account instance for org=${input.bookOrgId}, accountNo=${input.accountNo}, currency=${input.currency}`,
    );
  }

  return existing.id;
}

/** @deprecated Use ensureBookAccountInstanceTx with bookOrgId and dimensions. */
export async function ensureBookAccountTx(
  tx: Parameters<typeof ensureBookAccountInstanceTx>[0],
  input: { orgId: string; accountNo: string; currency: string },
) {
  return ensureBookAccountInstanceTx(tx, {
    bookOrgId: input.orgId,
    accountNo: input.accountNo,
    currency: input.currency,
    dimensions: {},
  });
}
