export const PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES = [
  "active",
  "archived",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_KIND_VALUES = [
  "customer",
  "counterparty",
  "organization",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_ROLE_VALUES = [
  "source",
  "hop",
  "destination",
] as const;
export const PAYMENT_ROUTE_PARTICIPANT_BINDING_VALUES = [
  "abstract",
  "bound",
] as const;
export const PAYMENT_ROUTE_LEG_SEMANTIC_TAG_VALUES = [
  "collection",
  "payout",
  "intracompany_transfer",
  "intercompany_transfer",
  "counterparty_transfer",
  "transfer",
  "fx_conversion",
] as const;
export const PAYMENT_ROUTE_LEG_TREASURY_OPERATION_HINT_VALUES = [
  "payin",
  "payout",
  "intracompany_transfer",
  "intercompany_funding",
  "fx_conversion",
] as const;
export const PAYMENT_ROUTE_FEE_KIND_VALUES = [
  "gross_percent",
  "net_percent",
  "fixed",
  "fx_spread",
] as const;
export const PAYMENT_ROUTE_FEE_APPLICATION_VALUES = [
  "embedded_in_rate",
  "deducted_from_flow",
  "separate_charge",
] as const;
export const PAYMENT_ROUTE_EXECUTION_COST_TREATMENT_VALUES = [
  "execution_spread",
  "flow_deduction",
  "separate_expense",
] as const;
export const PAYMENT_ROUTE_LOCKED_SIDE_VALUES = [
  "currency_in",
  "currency_out",
] as const;

export type PaymentRouteTemplateStatus =
  (typeof PAYMENT_ROUTE_TEMPLATE_STATUS_VALUES)[number];
export type PaymentRouteParticipantKind =
  (typeof PAYMENT_ROUTE_PARTICIPANT_KIND_VALUES)[number];
export type PaymentRouteParticipantRole =
  (typeof PAYMENT_ROUTE_PARTICIPANT_ROLE_VALUES)[number];
export type PaymentRouteParticipantBinding =
  (typeof PAYMENT_ROUTE_PARTICIPANT_BINDING_VALUES)[number];
export type PaymentRouteLegSemanticTag =
  (typeof PAYMENT_ROUTE_LEG_SEMANTIC_TAG_VALUES)[number];
export type PaymentRouteLegTreasuryOperationHint =
  (typeof PAYMENT_ROUTE_LEG_TREASURY_OPERATION_HINT_VALUES)[number];
export type PaymentRouteFeeKind =
  (typeof PAYMENT_ROUTE_FEE_KIND_VALUES)[number];
export type PaymentRouteFeeApplication =
  (typeof PAYMENT_ROUTE_FEE_APPLICATION_VALUES)[number];
export type PaymentRouteExecutionCostTreatment =
  (typeof PAYMENT_ROUTE_EXECUTION_COST_TREATMENT_VALUES)[number];
export type PaymentRouteLockedSide =
  (typeof PAYMENT_ROUTE_LOCKED_SIDE_VALUES)[number];

export type PaymentRouteParticipantRef =
  | {
      binding: "abstract";
      displayName: string;
      entityId: null;
      entityKind: null;
      nodeId: string;
      requisiteId: null;
      role: "source" | "destination";
    }
  | {
      binding: "bound";
      displayName: string;
      entityId: string;
      entityKind: "customer";
      nodeId: string;
      requisiteId: null;
      role: "source";
    }
  | {
      binding: "bound";
      displayName: string;
      entityId: string;
      entityKind: "organization" | "counterparty";
      nodeId: string;
      requisiteId: string | null;
      role: "destination" | "hop";
    };

export interface PaymentRouteFee {
  amountMinor?: string;
  application: PaymentRouteFeeApplication;
  currencyId?: string | null;
  id: string;
  kind: PaymentRouteFeeKind;
  label?: string;
  percentage?: string;
}

export interface PaymentRouteLeg {
  fees: PaymentRouteFee[];
  fromCurrencyId: string;
  id: string;
  toCurrencyId: string;
}

export interface PaymentRouteVisualMetadata {
  nodePositions: Record<string, { x: number; y: number }>;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface PaymentRouteDraft {
  additionalFees: PaymentRouteFee[];
  amountInMinor: string;
  amountOutMinor: string;
  currencyInId: string;
  currencyOutId: string;
  legs: PaymentRouteLeg[];
  lockedSide: PaymentRouteLockedSide;
  participants: PaymentRouteParticipantRef[];
}

interface PaymentRouteCalculationFeeBase {
  amountMinor: string;
  application: PaymentRouteFeeApplication;
  currencyId: string;
  id: string;
  inputImpactCurrencyId: string;
  inputImpactMinor: string;
  label?: string;
  outputImpactCurrencyId: string;
  outputImpactMinor: string;
  routeInputImpactMinor: string;
}

export interface PaymentRouteExecutionCostLine {
  amountMinor: string;
  application: PaymentRouteFeeApplication;
  currencyId: string;
  id: string;
  inputImpactCurrencyId: string;
  inputImpactMinor: string;
  kind: PaymentRouteFeeKind;
  label?: string;
  location: "additional" | "leg";
  outputImpactCurrencyId: string;
  outputImpactMinor: string;
  routeInputImpactMinor: string;
  treatment: PaymentRouteExecutionCostTreatment;
}

export type PaymentRouteCalculationFee =
  | (PaymentRouteCalculationFeeBase & {
      kind: "gross_percent";
      percentage: string;
    })
  | (PaymentRouteCalculationFeeBase & {
      kind: "net_percent";
      percentage: string;
    })
  | (PaymentRouteCalculationFeeBase & {
      kind: "fx_spread";
      percentage: string;
    })
  | (PaymentRouteCalculationFeeBase & {
      kind: "fixed";
    });

export interface PaymentRouteCalculationLeg {
  asOf: string;
  fees: PaymentRouteCalculationFee[];
  fromCurrencyId: string;
  grossOutputMinor: string;
  id: string;
  idx: number;
  inputAmountMinor: string;
  netOutputMinor: string;
  rateDen: string;
  rateNum: string;
  rateSource: string;
  toCurrencyId: string;
}

export interface PaymentRouteAmountTotal {
  amountMinor: string;
  currencyId: string;
}

export interface PaymentRouteCalculation {
  additionalFees: PaymentRouteCalculationFee[];
  amountInMinor: string;
  amountOutMinor: string;
  benchmarkPrincipalInMinor: string;
  cleanAmountOutMinor: string;
  computedAt: string;
  costPriceInMinor: string;
  currencyInId: string;
  currencyOutId: string;
  deductedExecutionCostMinor: string;
  embeddedExecutionCostMinor: string;
  executionCostLines: PaymentRouteExecutionCostLine[];
  executionPrincipalInMinor: string;
  feeTotals: PaymentRouteAmountTotal[];
  grossAmountOutMinor: string;
  internalFeeTotals: PaymentRouteAmountTotal[];
  legs: PaymentRouteCalculationLeg[];
  lockedSide: PaymentRouteLockedSide;
  netAmountOutMinor: string;
  separateExecutionCostMinor: string;
}

export interface PaymentRouteTemplateRecord {
  createdAt: Date;
  draft: PaymentRouteDraft;
  id: string;
  lastCalculation: PaymentRouteCalculation | null;
  maxMarginBps: number | null;
  minMarginBps: number | null;
  name: string;
  snapshotPolicy: "clone_on_attach";
  status: PaymentRouteTemplateStatus;
  updatedAt: Date;
  visual: PaymentRouteVisualMetadata;
}

export type PaymentRouteTemplateWriteModel = PaymentRouteTemplateRecord;
