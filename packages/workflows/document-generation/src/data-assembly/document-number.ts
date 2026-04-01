import { getUuidPrefix } from "@bedrock/shared/core/uuid";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDocumentNumber(
  value: unknown,
  fallbackId: unknown,
): string {
  const explicitNumber = normalizeText(value);
  if (explicitNumber) {
    return explicitNumber;
  }

  const fallback = normalizeText(fallbackId);
  if (!fallback) {
    return "";
  }

  return getUuidPrefix(fallback);
}
