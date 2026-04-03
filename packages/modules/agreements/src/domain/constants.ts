export const AGREEMENT_FEE_RULE_KIND_VALUES = [
  "agent_fee",
  "fixed_fee",
] as const;
export type AgreementFeeRuleKind =
  (typeof AGREEMENT_FEE_RULE_KIND_VALUES)[number];

export const AGREEMENT_FEE_RULE_UNIT_VALUES = ["bps", "money"] as const;
export type AgreementFeeRuleUnit =
  (typeof AGREEMENT_FEE_RULE_UNIT_VALUES)[number];

export const AGREEMENT_PARTY_ROLE_VALUES = [
  "customer",
  "organization",
] as const;
export type AgreementPartyRole = (typeof AGREEMENT_PARTY_ROLE_VALUES)[number];

export const AGREEMENTS_CREATE_IDEMPOTENCY_SCOPE = "agreements.create";
export const AGREEMENTS_UPDATE_IDEMPOTENCY_SCOPE = "agreements.update";
