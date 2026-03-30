export const DEAL_TYPE_VALUES = [
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
] as const;

export const DEAL_STATUS_VALUES = [
  "draft",
  "submitted",
  "rejected",
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
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

export const DEAL_STATUS_TRANSITIONS: Record<
  (typeof DEAL_STATUS_VALUES)[number],
  readonly (typeof DEAL_STATUS_VALUES)[number][]
> = {
  draft: ["submitted", "rejected", "cancelled"],
  submitted: ["preparing_documents", "rejected", "cancelled"],
  rejected: [],
  preparing_documents: ["awaiting_funds", "done", "cancelled"],
  awaiting_funds: ["awaiting_payment", "done", "cancelled"],
  awaiting_payment: ["closing_documents", "done", "cancelled"],
  closing_documents: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export function canTransitionDealStatus(
  from: (typeof DEAL_STATUS_VALUES)[number],
  to: (typeof DEAL_STATUS_VALUES)[number],
): boolean {
  return from === to || DEAL_STATUS_TRANSITIONS[from].includes(to);
}

export function canDealWriteTreasuryOrFormalDocuments(input: {
  status: (typeof DEAL_STATUS_VALUES)[number];
  type: (typeof DEAL_TYPE_VALUES)[number];
}): boolean {
  if (input.type !== "payment") {
    return false;
  }

  return !["draft", "rejected", "done", "cancelled"].includes(input.status);
}
