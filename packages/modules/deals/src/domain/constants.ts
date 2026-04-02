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

export const DEAL_LEG_KIND_VALUES = [
  "collect",
  "convert",
  "transit_hold",
  "payout",
  "settle_exporter",
] as const;

export const DEAL_LEG_STATE_VALUES = [
  "pending",
  "ready",
  "in_progress",
  "done",
  "blocked",
  "skipped",
] as const;

export const DEAL_CAPABILITY_KIND_VALUES = [
  "can_collect",
  "can_fx",
  "can_payout",
  "can_transit",
  "can_exporter_settle",
] as const;

export const DEAL_CAPABILITY_STATUS_VALUES = [
  "enabled",
  "disabled",
  "pending",
] as const;

export const DEAL_OPERATIONAL_POSITION_KIND_VALUES = [
  "customer_receivable",
  "provider_payable",
  "intercompany_due_from",
  "intercompany_due_to",
  "in_transit",
  "suspense",
  "exporter_expected_receivable",
  "fee_revenue",
  "spread_revenue",
] as const;

export const DEAL_OPERATIONAL_POSITION_STATE_VALUES = [
  "not_applicable",
  "pending",
  "ready",
  "in_progress",
  "done",
  "blocked",
] as const;
export const DEAL_ATTACHMENT_INGESTION_STATUS_VALUES = [
  "pending",
  "processing",
  "processed",
  "failed",
] as const;

export const DEAL_PARTICIPANT_ROLE_VALUES = [
  "customer",
  "applicant",
  "internal_entity",
  "external_payer",
  "external_beneficiary",
] as const;

export const DEAL_LEGACY_PARTICIPANT_ROLE_VALUES = [
  "customer",
  "organization",
  "counterparty",
] as const;

export const DEAL_SECTION_ID_VALUES = [
  "common",
  "moneyRequest",
  "incomingReceipt",
  "externalBeneficiary",
  "settlementDestination",
] as const;

export const DEAL_TIMELINE_EVENT_TYPE_VALUES = [
  "deal_created",
  "intake_saved",
  "participant_changed",
  "status_changed",
  "leg_state_changed",
  "quote_created",
  "quote_accepted",
  "quote_expired",
  "quote_used",
  "calculation_attached",
  "attachment_uploaded",
  "attachment_deleted",
  "attachment_ingested",
  "attachment_ingestion_failed",
  "document_created",
  "document_status_changed",
] as const;

export const DEAL_TIMELINE_VISIBILITY_VALUES = [
  "customer_safe",
  "internal",
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

export const DEAL_TRANSITION_BLOCKER_CODE_VALUES = [
  "intake_incomplete",
  "participant_missing",
  "capability_pending",
  "capability_disabled",
  "accepted_quote_missing",
  "accepted_quote_inactive",
  "calculation_missing",
  "approval_pending",
  "approval_rejected",
  "opening_document_missing",
  "opening_document_not_ready",
  "closing_document_missing",
  "closing_document_not_ready",
  "operational_position_incomplete",
  "operational_position_blocked",
  "execution_leg_blocked",
  "execution_leg_not_ready",
  "execution_leg_not_done",
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

export const DEAL_LEG_STATE_TRANSITIONS: Record<
  (typeof DEAL_LEG_STATE_VALUES)[number],
  readonly (typeof DEAL_LEG_STATE_VALUES)[number][]
> = {
  pending: ["ready", "blocked", "skipped"],
  ready: ["in_progress", "blocked", "skipped"],
  in_progress: ["done", "blocked"],
  done: [],
  blocked: ["ready", "skipped"],
  skipped: [],
};

export const DEAL_REQUIRED_SECTION_IDS_BY_TYPE = {
  payment: ["common", "moneyRequest", "externalBeneficiary"],
  currency_exchange: ["common", "moneyRequest", "settlementDestination"],
  currency_transit: [
    "common",
    "moneyRequest",
    "incomingReceipt",
    "externalBeneficiary",
  ],
  exporter_settlement: [
    "common",
    "moneyRequest",
    "incomingReceipt",
    "settlementDestination",
  ],
} as const;

export function canTransitionDealStatus(
  from: (typeof DEAL_STATUS_VALUES)[number],
  to: (typeof DEAL_STATUS_VALUES)[number],
): boolean {
  return from === to || DEAL_STATUS_TRANSITIONS[from].includes(to);
}

export function canTransitionDealLegState(
  from: (typeof DEAL_LEG_STATE_VALUES)[number],
  to: (typeof DEAL_LEG_STATE_VALUES)[number],
): boolean {
  return from === to || DEAL_LEG_STATE_TRANSITIONS[from].includes(to);
}

export function canDealWriteTreasuryOrFormalDocuments(input: {
  status: (typeof DEAL_STATUS_VALUES)[number];
  type: (typeof DEAL_TYPE_VALUES)[number];
}): boolean {
  return !["draft", "rejected", "done", "cancelled"].includes(input.status);
}
