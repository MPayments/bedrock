import type { FeeRuleSnapshot } from "../../domain/fee-rule";
import type {
  FeeDealDirection,
  FeeDealForm,
  FeeOperationKind,
} from "../contracts";

export interface FeeRuleCandidateQuery {
  operationKind: FeeOperationKind;
  at: Date;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
  fromCurrencyId: string | null;
  toCurrencyId: string | null;
}

export interface FeeRulesStore {
  insertRule(input: FeeRuleSnapshot): Promise<void>;
}

export interface FeeRulesReads {
  listCandidateRules(input: FeeRuleCandidateQuery): Promise<FeeRuleSnapshot[]>;
}

export type FeeRuleRepository = FeeRulesStore & FeeRulesReads;
