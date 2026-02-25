import { createHash } from "node:crypto";

export const TB_ID_MAX = (1n << 128n) - 1n;
export const TB_ID_MAX_ALLOWED = TB_ID_MAX - 1n;

export function normalizeTbId(x: bigint): bigint {
  if (x <= 0n) return 1n;
  if (x >= TB_ID_MAX) return TB_ID_MAX_ALLOWED;
  return x;
}

export function u128FromHash(input: string): bigint {
  const h = createHash("sha256").update(input).digest();
  let x = 0n;
  for (let i = 0; i < 16; i++) x = (x << 8n) | BigInt(h[i]!);
  return normalizeTbId(x);
}

// TB ledger id is u32. Store in PG as bigint to avoid signed int overflow.
export function tbLedgerForCurrency(currency: string): number {
  const h = createHash("sha256").update(`cur:${currency}`).digest();
  const n = (h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!;
  const u = n >>> 0;
  return u === 0 ? 1 : u;
}

export function tbBookAccountIdFor(
  orgId: string,
  accountNo: string,
  currency: string,
  tbLedger: number,
): bigint {
  return u128FromHash(`book:${orgId}:${accountNo}:${currency}:${tbLedger}`);
}

export function tbTransferIdForOperation(
  operationId: string,
  lineNo: number,
  planRef: string,
): bigint {
  return u128FromHash(`op:${operationId}:${lineNo}:${planRef}`);
}
