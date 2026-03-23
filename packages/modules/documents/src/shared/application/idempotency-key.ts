import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/shared/core/crypto";

export function buildDefaultActionIdempotencyKey(
  action: string,
  payload: Record<string, unknown>,
) {
  return sha256Hex(canonicalJson({ action, ...payload }));
}
