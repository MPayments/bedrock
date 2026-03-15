export const REQUISITE_KIND_VALUES = [
  "bank",
  "exchange",
  "blockchain",
  "custodian",
] as const;

export type RequisiteKind = (typeof REQUISITE_KIND_VALUES)[number];

export const REQUISITE_OWNER_TYPE_VALUES = [
  "organization",
  "counterparty",
] as const;

export type RequisiteOwnerType = (typeof REQUISITE_OWNER_TYPE_VALUES)[number];
