export type FeeDealDirection =
  | "cash_to_wire"
  | "wire_to_cash"
  | "wire_to_wire"
  | "usdt_to_cash"
  | "cash_to_usdt"
  | "other";

export type FeeDealForm = "conversion" | "transit";

export type FeeOperationKind =
  | "fx_quote"
  | "fx_execution"
  | "funding"
  | "payout"
  | "internal_transfer"
  | "external_transfer"
  | "custom";

export type FeeCalcMethod = "bps" | "fixed";

export type FeeComponentKind =
  | "fx_fee"
  | "fx_spread"
  | "bank_fee"
  | "blockchain_fee"
  | "manual_fee"
  | (string & {});

export type FeeSource = "rule" | "manual";

export type FeeSettlementMode = "in_ledger" | "separate_payment_order";
export type FeeAccountingTreatment = "income" | "pass_through" | "expense";

export type AdjustmentKind =
  | "late_penalty"
  | "discount"
  | "manual_adjustment"
  | (string & {});

export type AdjustmentEffect = "increase_charge" | "decrease_charge";

export type AdjustmentSource = "manual" | "rule";

export type AdjustmentSettlementMode = FeeSettlementMode;

export interface FeeComponent {
  id: string;
  ruleId?: string;
  kind: FeeComponentKind;
  currency: string;
  amountMinor: bigint;
  source: FeeSource;
  settlementMode?: FeeSettlementMode;
  accountingTreatment?: FeeAccountingTreatment;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface AdjustmentComponent {
  id: string;
  kind: AdjustmentKind;
  effect: AdjustmentEffect;
  currency: string;
  amountMinor: bigint;
  source: AdjustmentSource;
  settlementMode?: AdjustmentSettlementMode;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface CalculateQuoteFeeComponentsInput {
  fromCurrency: string;
  toCurrency: string;
  principalMinor: bigint;
  at: Date;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
}

export interface CreateFeeRuleInput {
  name: string;
  operationKind: FeeOperationKind;
  feeKind: FeeComponentKind;
  calcMethod: FeeCalcMethod;
  bps?: number;
  fixedAmountMinor?: bigint;
  fixedCurrency?: string;
  settlementMode?: FeeSettlementMode;
  accountingTreatment?: FeeAccountingTreatment;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
  fromCurrency?: string;
  toCurrency?: string;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface ResolveFeeRulesInput {
  operationKind: FeeOperationKind;
  at: Date;
  fromCurrency?: string;
  toCurrency?: string;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
}

export interface ApplicableFeeRule {
  id: string;
  calcMethod: FeeCalcMethod;
  bps: number | null;
  fixedAmountMinor: bigint | null;
  fixedCurrencyId: string | null;
  feeKind: FeeComponentKind;
  settlementMode: FeeSettlementMode;
  accountingTreatment: FeeAccountingTreatment;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface MergeFeeComponentsInput {
  computed?: FeeComponent[];
  manual?: FeeComponent[];
  aggregate?: boolean;
}

export interface MergeAdjustmentComponentsInput {
  computed?: AdjustmentComponent[];
  manual?: AdjustmentComponent[];
  aggregate?: boolean;
}

export interface PartitionedFeeComponents {
  inLedger: FeeComponent[];
  separatePaymentOrder: FeeComponent[];
}

export interface PartitionedAdjustmentComponents {
  inLedger: AdjustmentComponent[];
  separatePaymentOrder: AdjustmentComponent[];
}
