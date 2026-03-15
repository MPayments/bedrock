import type {
  ApplicableFeeRule,
  CalculateFxQuoteFeeComponentsInput,
  FeeComponent,
  GetQuoteFeeComponentsInput,
  ResolveFeeRulesInput,
} from "../contracts";
import { calculateBpsAmount } from "../domain/math";
import type { Transaction } from "@bedrock/platform/persistence";
import type { FeesServiceContext } from "./shared/context";
import {
  validateFxQuoteFeeCalculation,
  validateGetQuoteFeeComponentsInput,
  validateResolveFeeRulesInput,
} from "./validation";

export function createFeesQueryHandlers(context: FeesServiceContext) {
  const {
    currenciesService,
    rulesRepository,
    quoteSnapshotsQueryRepository,
  } = context;

  async function listApplicableRules(
    input: ResolveFeeRulesInput,
    _tx?: Transaction,
  ): Promise<ApplicableFeeRule[]> {
    const validated = validateResolveFeeRulesInput(input);

    const fromCurrencyId = validated.fromCurrency
      ? (await currenciesService.findByCode(validated.fromCurrency)).id
      : null;
    const toCurrencyId = validated.toCurrency
      ? (await currenciesService.findByCode(validated.toCurrency)).id
      : null;

    return rulesRepository.listApplicableRules({
      operationKind: validated.operationKind,
      at: validated.at,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      fromCurrencyId,
      toCurrencyId,
    });
  }

  async function calculateFxQuoteFeeComponents(
    input: CalculateFxQuoteFeeComponentsInput,
    tx?: Transaction,
  ): Promise<FeeComponent[]> {
    const validated = validateFxQuoteFeeCalculation(input);
    const rules = await listApplicableRules(
      {
        operationKind: "fx_quote",
        at: validated.at,
        fromCurrency: validated.fromCurrency,
        toCurrency: validated.toCurrency,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
      },
      tx,
    );

    const components: FeeComponent[] = [];

    for (const rule of rules) {
      let amountMinor = 0n;

      if (rule.calcMethod === "bps") {
        if (rule.bps === null) {
          continue;
        }

        amountMinor = calculateBpsAmount(validated.principalMinor, rule.bps);
      } else {
        amountMinor = rule.fixedAmountMinor ?? 0n;
      }

      if (amountMinor <= 0n) {
        continue;
      }

      const currency =
        rule.calcMethod === "fixed"
          ? rule.fixedCurrencyId
            ? (await currenciesService.findById(rule.fixedCurrencyId)).code
            : validated.fromCurrency
          : validated.fromCurrency;

      components.push({
        id: `rule:${rule.id}`,
        ruleId: rule.id,
        kind: rule.feeKind,
        currency,
        amountMinor,
        source: "rule",
        settlementMode: rule.settlementMode,
        accountingTreatment: rule.accountingTreatment,
        memo: rule.memo ?? undefined,
        metadata: rule.metadata ?? undefined,
      });
    }

    return components;
  }

  async function getQuoteFeeComponents(
    input: GetQuoteFeeComponentsInput,
    tx?: Transaction,
  ): Promise<FeeComponent[]> {
    const validated = validateGetQuoteFeeComponentsInput(input);
    const rows = await quoteSnapshotsQueryRepository.listQuoteFeeComponents(
      validated.quoteId,
      tx,
    );
    const uniqueCurrencyIds = [...new Set(rows.map((row) => row.currencyId))];
    const currencyCodeById = new Map<string, string>();

    await Promise.all(
      uniqueCurrencyIds.map(async (id) => {
        const currency = await currenciesService.findById(id);
        currencyCodeById.set(id, currency.code);
      }),
    );

    return rows
      .slice()
      .sort((left, right) => left.idx - right.idx)
      .map((row) => ({
        id: `quote_component:${row.quoteId}:${row.idx}`,
        ruleId: row.ruleId ?? undefined,
        kind: row.kind,
        currency: currencyCodeById.get(row.currencyId)!,
        amountMinor: row.amountMinor,
        source: row.source,
        settlementMode: row.settlementMode,
        memo: row.memo ?? undefined,
        metadata: row.metadata ?? undefined,
      }));
  }

  return {
    listApplicableRules,
    calculateFxQuoteFeeComponents,
    getQuoteFeeComponents,
  };
}
