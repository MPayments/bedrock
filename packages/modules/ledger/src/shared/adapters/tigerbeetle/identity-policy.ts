import { createHash } from "node:crypto";

import type { SettlementIdentityPolicy } from "../../application/settlement-identity";
import { computeDimensionsHash } from "../../domain/dimensions-hash";

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
  for (let i = 0; i < 16; i += 1) {
    x = (x << 8n) | BigInt(h[i]!);
  }
  return normalizeTbId(x);
}

export function tbLedgerForCurrency(currency: string): number {
  const h = createHash("sha256").update(`cur:${currency}`).digest();
  const n = (h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!;
  const u = n >>> 0;
  return u === 0 ? 1 : u;
}

export function tbBookAccountInstanceIdFor(input: {
  bookId: string;
  accountNo: string;
  currency: string;
  dimensions: Record<string, string>;
}): bigint {
  const dimensionsHash = computeDimensionsHash(input.dimensions);
  const tbLedger = tbLedgerForCurrency(input.currency);

  return u128FromHash(
    `instance:${input.bookId}:${input.accountNo}:${input.currency}:${dimensionsHash}:${tbLedger}`,
  );
}

export function tbTransferIdForOperation(input: {
  operationId: string;
  lineNo: number;
  planRef: string;
}): bigint {
  return u128FromHash(
    `op:${input.operationId}:${input.lineNo}:${input.planRef}`,
  );
}

export class TigerBeetleSettlementIdentityPolicy
  implements SettlementIdentityPolicy
{
  settlementIdForOperationLine(input: {
    operationId: string;
    lineNo: number;
    planRef: string;
  }): bigint {
    return tbTransferIdForOperation(input);
  }

  settlementLedgerForCurrency(input: { currency: string }): number {
    return tbLedgerForCurrency(input.currency);
  }
}
