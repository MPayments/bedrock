import { FeeRule } from "../../domain/fee-rule";
import { FeeRuleSet } from "../../domain/fee-rule-set";
import {
  calculateQuoteFeeComponentsSchema,
  type CalculateQuoteFeeComponentsInput,
  type FeeComponent,
} from "../contracts";
import type { FeesCurrenciesPort } from "../ports/currencies.port";
import type { FeeRulesReads } from "../ports/fee-rules.repository";

export class CalculateQuoteFeeComponentsQuery {
  constructor(
    private readonly currencies: FeesCurrenciesPort,
    private readonly rulesReads: FeeRulesReads,
  ) {}

  async execute(
    input: CalculateQuoteFeeComponentsInput,
  ): Promise<FeeComponent[]> {
    const validated = calculateQuoteFeeComponentsSchema.parse(input);
    const fromCurrencyId = (await this.currencies.findByCode(validated.fromCurrency))
      .id;
    const toCurrencyId = (await this.currencies.findByCode(validated.toCurrency))
      .id;
    const candidateRules = await this.rulesReads.listCandidateRules(
      {
        operationKind: "fx_quote",
        at: validated.at,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
        fromCurrencyId,
        toCurrencyId,
      },
    );
    const rules = FeeRuleSet.create(
      candidateRules.map((rule) => FeeRule.fromSnapshot(rule)),
    ).resolveApplicable({
      operationKind: "fx_quote",
      at: validated.at,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      fromCurrencyId,
      toCurrencyId,
    });

    const components: FeeComponent[] = [];
    const fixedCurrencyIds = [
      ...new Set(
        rules
          .map((rule) => rule.toSnapshot().fixedCurrencyId)
          .filter((currencyId): currencyId is string => Boolean(currencyId)),
      ),
    ];
    const fixedCurrencyCodeById = new Map<string, string>();
    await Promise.all(
      fixedCurrencyIds.map(async (currencyId) => {
        const currency = await this.currencies.findById(currencyId);
        fixedCurrencyCodeById.set(currencyId, currency.code);
      }),
    );

    for (const rule of rules) {
      const component = rule.toFeeComponent({
        principalMinor: validated.principalMinor,
        defaultCurrency: validated.fromCurrency,
        fixedCurrency: rule.toSnapshot().fixedCurrencyId
          ? fixedCurrencyCodeById.get(rule.toSnapshot().fixedCurrencyId!)
          : undefined,
      });
      if (component) {
        components.push(component);
      }
    }

    return components;
  }
}
