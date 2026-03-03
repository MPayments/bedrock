import { normalizeMoneyFields } from "./amount";
import { toJsonSafe } from "./json";

type ApiJsonOptions = {
  normalizeMoney?: boolean;
};

type JsonContextLike = {
  json: (body: unknown, status?: number) => Response;
};

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
): Response {
  return c.json(toApiJson(value, options), status);
}
