import { sha256Hex } from "@bedrock/platform/crypto";
import { canonicalJson } from "@bedrock/shared/core/canon";

export function buildDefaultActionIdempotencyKey(
  action: string,
  payload: Record<string, unknown>,
) {
  return sha256Hex(canonicalJson({ action, ...payload }));
}
