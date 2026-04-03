import { toJsonSafe } from "@bedrock/shared/core/json";

import { normalizeMoneyFields } from "./amount";

interface ApiJsonOptions {
  normalizeMoney?: boolean;
}

interface JsonContextLike {
  json: (body: unknown, status?: number) => any;
}

export function toApiJson(value: unknown, options?: ApiJsonOptions): unknown {
  const normalized =
    options?.normalizeMoney === true ? normalizeMoneyFields(value) : value;
  return toJsonSafe(normalized);
}

export function jsonOk(
  c: JsonContextLike,
  value: unknown,
  status = 200,
  options?: ApiJsonOptions,
): any {
  return c.json(toApiJson(value, options), status);
}
