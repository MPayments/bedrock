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

function tbBookAccountIdFor(
  orgId: string,
  accountNo: string,
  currency: string,
  tbLedger: number,
): bigint {
  return u128FromHash(`book:${orgId}:${accountNo}:${currency}:${tbLedger}`);
}

interface EnsureBookAccountInput {
  orgId: string;
  accountNo: string;
  currency: string;
}

export async function ensureBookAccountTx(
  tx: any,
  input: EnsureBookAccountInput,
) {
  const tbLedger = tbLedgerForCurrency(input.currency);
  const tbAccountId = tbBookAccountIdFor(
    input.orgId,
    input.accountNo,
    input.currency,
    tbLedger,
  );

  const inserted = await tx
    .insert(schema.bookAccounts)
    .values({
      orgId: input.orgId,
      accountNo: input.accountNo,
      currency: input.currency,
      tbLedger,
      tbAccountId,
    })
    .onConflictDoNothing()
    .returning({ id: schema.bookAccounts.id });

  if (inserted.length > 0) {
    return inserted[0]!.id;
  }

  const [existing] = await tx
    .select({ id: schema.bookAccounts.id })
    .from(schema.bookAccounts)
    .where(
      and(
        eq(schema.bookAccounts.orgId, input.orgId),
        eq(schema.bookAccounts.accountNo, input.accountNo),
        eq(schema.bookAccounts.currency, input.currency),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(
      `Failed to resolve book account for org=${input.orgId}, accountNo=${input.accountNo}, currency=${input.currency}`,
    );
  }

  return existing.id;
}
