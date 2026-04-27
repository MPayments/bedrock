export const FILE_ORIGIN_VALUES = ["uploaded", "generated"] as const;
export const FILE_LINK_KIND_VALUES = [
  "deal_attachment",
  "legal_entity_attachment",
  "agreement_signed_contract",
  "payment_step_evidence",
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
