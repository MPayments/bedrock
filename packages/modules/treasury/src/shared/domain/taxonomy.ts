export const OBLIGATION_KINDS = [
  "ap_invoice",
  "ar_invoice",
  "refund_obligation",
  "withdrawal_obligation",
  "intercompany_claim",
  "customer_liability",
] as const;

export const OPERATION_KINDS = [
  "collection",
  "payout",
  "intracompany_transfer",
  "intercompany_funding",
  "fx_conversion",
  "sweep",
  "return",
  "adjustment",
] as const;

export const INSTRUCTION_STATUSES = [
  "draft",
  "approved",
  "reserved",
  "submitted",
  "partially_settled",
  "settled",
  "failed",
  "returned",
  "void",
] as const;

export const EXECUTION_EVENT_KINDS = [
  "submitted",
  "accepted",
  "settled",
  "failed",
  "returned",
  "voided",
  "fee_charged",
  "manual_adjustment",
] as const;

export const LEG_KINDS = [
  "principal",
  "fee",
  "tax",
  "reserve",
  "release",
  "fx_sell",
  "fx_buy",
  "network_fee",
  "bank_fee",
] as const;

export const POSITION_KINDS = [
  "customer_liability",
  "intercompany_due_from",
  "intercompany_due_to",
  "in_transit",
  "suspense",
] as const;

export const SETTLEMENT_MODELS = ["direct", "pobo", "robo"] as const;

export const BENEFICIAL_OWNER_TYPES = [
  "customer",
  "legal_entity",
  "counterparty",
] as const;

export const LEGAL_BASES = [
  "loan",
  "settlement",
  "recharge",
  "capital_contribution",
  "dividend",
  "other",
] as const;

export const TREASURY_ACCOUNT_KINDS = [
  "bank",
  "wallet",
  "exchange",
  "custodial",
  "virtual",
  "internal_control",
] as const;

export const SUBMISSION_CHANNELS = ["manual"] as const;

export const BALANCE_STATES = ["pending", "reserved", "booked"] as const;

export const ALLOCATION_TYPES = [
  "principal",
  "fee",
  "tax",
  "adjustment",
] as const;

export const EXTERNAL_RECORD_KINDS = [
  "provider_transaction",
  "statement_line",
  "blockchain_tx",
  "exchange_fill",
  "fee_charge",
  "manual_adjustment",
] as const;

export type ObligationKind = (typeof OBLIGATION_KINDS)[number];
export type OperationKind = (typeof OPERATION_KINDS)[number];
export type InstructionStatus = (typeof INSTRUCTION_STATUSES)[number];
export type ExecutionEventKind = (typeof EXECUTION_EVENT_KINDS)[number];
export type LegKind = (typeof LEG_KINDS)[number];
export type PositionKind = (typeof POSITION_KINDS)[number];
export type SettlementModel = (typeof SETTLEMENT_MODELS)[number];
export type BeneficialOwnerType = (typeof BENEFICIAL_OWNER_TYPES)[number];
export type LegalBasis = (typeof LEGAL_BASES)[number];
export type TreasuryAccountKind = (typeof TREASURY_ACCOUNT_KINDS)[number];
export type SubmissionChannel = (typeof SUBMISSION_CHANNELS)[number];
export type BalanceState = (typeof BALANCE_STATES)[number];
export type AllocationType = (typeof ALLOCATION_TYPES)[number];
export type ExternalRecordKind = (typeof EXTERNAL_RECORD_KINDS)[number];
