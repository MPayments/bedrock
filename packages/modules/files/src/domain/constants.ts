export const FILE_ORIGIN_VALUES = ["uploaded", "generated"] as const;
export const FILE_LINK_KIND_VALUES = [
  "deal_attachment",
  "legal_entity_attachment",
  "deal_invoice",
  "deal_acceptance",
  "legal_entity_contract",
] as const;
export const FILE_GENERATED_FORMAT_VALUES = ["docx", "pdf"] as const;
export const FILE_GENERATED_LANG_VALUES = ["ru", "en"] as const;
export const FILE_ATTACHMENT_VISIBILITY_VALUES = [
  "customer_safe",
  "internal",
] as const;
export const FILE_ATTACHMENT_PURPOSE_VALUES = [
  "invoice",
  "contract",
  "other",
] as const;

export const GENERATED_FILE_LINK_KINDS = new Set<
  (typeof FILE_LINK_KIND_VALUES)[number]
>([
  "deal_invoice",
  "deal_acceptance",
  "legal_entity_contract",
]);

export const ATTACHMENT_FILE_LINK_KINDS = new Set<
  (typeof FILE_LINK_KIND_VALUES)[number]
>(["deal_attachment", "legal_entity_attachment"]);
