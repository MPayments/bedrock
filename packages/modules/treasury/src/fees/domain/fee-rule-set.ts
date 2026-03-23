import type { FeeRule } from "./fee-rule";
import type {
  FeeDealDirection,
  FeeDealForm,
  FeeOperationKind,
} from "./fee-types";

export class FeeRuleSet {
  constructor(private readonly rules: FeeRule[]) {}

  static create(rules: FeeRule[]) {
    return new FeeRuleSet(rules.slice());
  }

  resolveApplicable(input: {
    operationKind: FeeOperationKind;
    at: Date;
    dealDirection?: FeeDealDirection;
    dealForm?: FeeDealForm;
    fromCurrencyId?: string | null;
    toCurrencyId?: string | null;
  }): FeeRule[] {
    return this.rules
      .filter((rule) => rule.isApplicable(input))
      .sort((left, right) => left.comparePrecedence(right));
  }
}
