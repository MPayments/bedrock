import type { OrganizationKind } from "@bedrock/sdk-organizations-ui/lib/contracts";

export const KIND_LABELS: Record<OrganizationKind, string> = {
  legal_entity: "Юридическое лицо",
  individual: "Физическое лицо",
};

export const KIND_FILTER_OPTIONS = [
  { value: "legal_entity", label: KIND_LABELS.legal_entity },
  { value: "individual", label: KIND_LABELS.individual },
] as const;
