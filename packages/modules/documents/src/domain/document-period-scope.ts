import { dedupeIds } from "@bedrock/shared/core/domain";

const ORGANIZATION_ID_PAYLOAD_KEYS = [
  "organizationId",
  "sourceOrganizationId",
  "destinationOrganizationId",
] as const;

function readOrganizationIdsFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string[] {
  if (!payload) {
    return [];
  }

  return dedupeIds(
    ORGANIZATION_ID_PAYLOAD_KEYS.flatMap((key) => {
      const value = payload[key];
      return typeof value === "string" && value.trim().length > 0 ? [value] : [];
    }),
  );
}

export function collectDocumentOrganizationIds(input: {
  payload?: Record<string, unknown> | null;
}): string[] {
  return readOrganizationIdsFromPayload(input.payload).filter(
    (value) => value.trim().length > 0,
  );
}
