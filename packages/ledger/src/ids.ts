import { createHash } from "node:crypto";

/**
 * Derives a 128-bit bigint from a string using SHA-256 (truncated).
 * 128-bit hash; collision probability is negligible for expected account counts
 * (birthday bound ~2^64 operations before collision becomes likely).
 */
export function bigintFromString128(input: string): bigint {
  const bytes = createHash("sha256").update(input).digest().subarray(0, 16);
  let out = 0n;
  for (const b of bytes) {
    out = (out << 8n) | BigInt(b);
  }
  return out;
}

export function tbAccountIdFromKey(refKey: string): bigint {
  return bigintFromString128(`tb:account:${refKey}`);
}

export function tbTransferIdFromKey(idempotencyKey: string): bigint {
  return bigintFromString128(`tb:transfer:${idempotencyKey}`);
}
