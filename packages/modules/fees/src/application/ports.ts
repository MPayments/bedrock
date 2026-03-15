import type { Queryable } from "@bedrock/platform/persistence";

import type {
  FeeAccountingTreatment,
  FeeCalcMethod,
  FeeComponentKind,
  FeeOperationKind,
  FeeSettlementMode,
  FeeSource,
} from "../contracts";

export type FeesDbExecutor = Queryable;

export interface FeesCurrencyRecord {
  id: string;
  code: string;
}

export interface FeesCurrenciesPort {
  findByCode(code: string): Promise<FeesCurrencyRecord>;
  findById(id: string): Promise<FeesCurrencyRecord>;
}

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

export interface FeesRulesRepositoryPort {
  insertRule(input: FeesRuleWriteModel): Promise<string>;
  listApplicableRules(
    input: {
      operationKind: FeeOperationKind;
      at: Date;
      dealDirection?: string;
      dealForm?: string;
      fromCurrencyId: string | null;
      toCurrencyId: string | null;
    },
    executor?: FeesDbExecutor,
  ): Promise<FeesRuleRecord[]>;
}

export interface FeesQuoteComponentSnapshotWriteModel {
  quoteId: string;
  idx: number;
  ruleId: string | null;
  kind: FeeComponentKind;
  currencyId: string;
  amountMinor: bigint;
  source: FeeSource;
  settlementMode: FeeSettlementMode;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface FeesQuoteComponentSnapshotRecord {
  quoteId: string;
  idx: number;
  ruleId: string | null;
  kind: FeeComponentKind;
  currencyId: string;
  amountMinor: bigint;
  source: FeeSource;
  settlementMode: FeeSettlementMode;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface FeesQuoteSnapshotsRepositoryPort {
  replaceQuoteFeeComponents(
    input: {
      quoteId: string;
      components: FeesQuoteComponentSnapshotWriteModel[];
    },
    executor?: FeesDbExecutor,
  ): Promise<void>;
  listQuoteFeeComponents(
    quoteId: string,
    executor?: FeesDbExecutor,
  ): Promise<FeesQuoteComponentSnapshotRecord[]>;
}
