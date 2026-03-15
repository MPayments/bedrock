import type {
  FeeAccountingTreatment,
  FeeCalcMethod,
  FeeComponentKind,
  FeeOperationKind,
  FeeSettlementMode,
} from "../../contracts";

export interface FeesRuleWriteModel {
  name: string;
  operationKind: FeeOperationKind;
  feeKind: FeeComponentKind;
  calcMethod: FeeCalcMethod;
  bps?: number;
  fixedAmountMinor?: bigint;
  fixedCurrencyId: string | null;
  settlementMode: FeeSettlementMode;
  accountingTreatment: FeeAccountingTreatment;
  dealDirection?: string;
  dealForm?: string;
  fromCurrencyId: string | null;
  toCurrencyId: string | null;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface FeesRuleRecord {
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

export interface FeesRulesRepository {
  insertRule(input: FeesRuleWriteModel): Promise<string>;
  listApplicableRules(input: {
    operationKind: FeeOperationKind;
    at: Date;
    dealDirection?: string;
    dealForm?: string;
    fromCurrencyId: string | null;
    toCurrencyId: string | null;
  }): Promise<FeesRuleRecord[]>;
}
