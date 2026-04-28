import type {
  PaymentStepKind,
  PaymentStepRate,
  PaymentStepRouteSnapshot,
} from "../../payment-steps/domain/types";

export const TREASURY_ORDER_TYPE_VALUES = [
  "single_payment",
  "fx_exchange",
  "rebalance",
  "pre_fund",
  "liquidity_purchase",
] as const;

export const TREASURY_ORDER_STATE_VALUES = [
  "draft",
  "active",
  "completed",
  "cancelled",
  "failed",
] as const;

export type TreasuryOrderType = (typeof TREASURY_ORDER_TYPE_VALUES)[number];
export type TreasuryOrderState = (typeof TREASURY_ORDER_STATE_VALUES)[number];
export type TreasuryOrderStepKind = PaymentStepKind | "quote_execution";

export const TREASURY_INVENTORY_POSITION_STATE_VALUES = [
  "open",
  "exhausted",
  "cancelled",
] as const;

export const TREASURY_INVENTORY_ALLOCATION_STATE_VALUES = [
  "reserved",
  "consumed",
  "released",
] as const;

export type TreasuryInventoryPositionState =
  (typeof TREASURY_INVENTORY_POSITION_STATE_VALUES)[number];
export type TreasuryInventoryAllocationState =
  (typeof TREASURY_INVENTORY_ALLOCATION_STATE_VALUES)[number];

export interface TreasuryOrderStepPlanRecord extends PaymentStepRouteSnapshot {
  createdAt: Date;
  id: string;
  kind: TreasuryOrderStepKind;
  paymentStepId: string | null;
  quoteExecutionId: string | null;
  quoteId: string | null;
  sequence: number;
  sourceRef: string;
  updatedAt: Date;
}

export interface TreasuryOrderRecord {
  activatedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  description: string | null;
  id: string;
  state: TreasuryOrderState;
  steps: TreasuryOrderStepPlanRecord[];
  type: TreasuryOrderType;
  updatedAt: Date;
}

export interface TreasuryInventoryPositionRecord {
  acquiredAmountMinor: bigint;
  availableAmountMinor: bigint;
  costAmountMinor: bigint;
  costCurrencyId: string;
  createdAt: Date;
  currencyId: string;
  id: string;
  ledgerSubjectType: "organization_requisite";
  ownerBookId: string;
  ownerPartyId: string;
  ownerRequisiteId: string;
  sourceOrderId: string;
  sourcePostingDocumentId: string;
  sourcePostingDocumentKind: "fx_execute";
  sourceQuoteExecutionId: string;
  state: TreasuryInventoryPositionState;
  updatedAt: Date;
}

export interface TreasuryInventoryAllocationRecord {
  amountMinor: bigint;
  costAmountMinor: bigint;
  consumedAt: Date | null;
  createdAt: Date;
  currencyId: string;
  dealId: string;
  id: string;
  ledgerHoldRef: string;
  ownerBookId: string;
  ownerRequisiteId: string;
  positionId: string;
  quoteId: string | null;
  releasedAt: Date | null;
  reservedAt: Date;
  state: TreasuryInventoryAllocationState;
  updatedAt: Date;
}

export interface CreateTreasuryOrderStepPlanProps {
  fromAmountMinor?: bigint | null;
  fromCurrencyId: string;
  fromParty: PaymentStepRouteSnapshot["fromParty"];
  kind: TreasuryOrderStepKind;
  quoteId?: string | null;
  rate?: PaymentStepRate | null;
  toAmountMinor?: bigint | null;
  toCurrencyId: string;
  toParty: PaymentStepRouteSnapshot["toParty"];
}
