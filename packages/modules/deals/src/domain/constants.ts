export const DEAL_TYPE_VALUES = [
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
] as const;

export const DEAL_STATUS_VALUES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "executing",
  "completed",
  "cancelled",
] as const;

export const DEAL_LEG_KIND_VALUES = DEAL_TYPE_VALUES;

export const DEAL_PARTICIPANT_ROLE_VALUES = [
  "customer",
  "organization",
  "counterparty",
] as const;

export const DEAL_APPROVAL_TYPE_VALUES = [
  "commercial",
  "compliance",
  "operations",
] as const;

export const DEAL_APPROVAL_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const DEALS_CREATE_IDEMPOTENCY_SCOPE = "deals.create";
