import { canonicalJson } from "@bedrock/shared/core/canon";

export function toStoredJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}
