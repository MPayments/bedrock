import { FeeRule } from "../../domain/fee-rule";
import { FeeRuleSet } from "../../domain/fee-rule-set";
import {
  type ApplicableFeeRule,
  type ResolveFeeRulesInput,
  resolveFeeRulesInputSchema,
} from "../contracts";
import type { FeesCurrenciesPort } from "../ports/currencies.port";
import type { FeeRulesReads } from "../ports/fee-rules.repository";

export class ListApplicableRulesQuery {
  constructor(
    private readonly currencies: FeesCurrenciesPort,
    private readonly rulesReads: FeeRulesReads,
  ) {}

  async execute(
    input: ResolveFeeRulesInput,
  ): Promise<ApplicableFeeRule[]> {
    const validated = resolveFeeRulesInputSchema.parse(input);
    const fromCurrencyId = validated.fromCurrency
      ? (await this.currencies.findByCode(validated.fromCurrency)).id
      : null;
    const toCurrencyId = validated.toCurrency
      ? (await this.currencies.findByCode(validated.toCurrency)).id
      : null;

    const candidateRules = await this.rulesReads.listCandidateRules(
      {
        operationKind: validated.operationKind,
        at: validated.at,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
        fromCurrencyId,
        toCurrencyId,
      },
    );

    return FeeRuleSet.create(
      candidateRules.map((rule) => FeeRule.fromSnapshot(rule)),
    )
      .resolveApplicable({
        operationKind: validated.operationKind,
        at: validated.at,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
        fromCurrencyId,
        toCurrencyId,
      })
      .map((rule) => rule.toApplicableRule());
  }
}
