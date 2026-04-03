import type { ModuleRuntime } from "@bedrock/shared/core";

import { FeeRule } from "../../domain/fee-rule";
import {
  createFeeRuleSchema,
  type CreateFeeRuleInput,
} from "../contracts";
import type { FeesCurrenciesPort } from "../ports/currencies.port";
import type { FeeRulesStore } from "../ports/fee-rules.repository";

export class CreateFeeRuleCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: FeesCurrenciesPort,
    private readonly rulesStore: FeeRulesStore,
  ) {}

  async execute(input: CreateFeeRuleInput): Promise<string> {
    const validated = createFeeRuleSchema.parse(input);
    const ruleId = this.runtime.generateUuid();

    const fixedCurrencyId = validated.fixedCurrency
      ? (await this.currencies.findByCode(validated.fixedCurrency)).id
      : null;
    const fromCurrencyId = validated.fromCurrency
      ? (await this.currencies.findByCode(validated.fromCurrency)).id
      : null;
    const toCurrencyId = validated.toCurrency
      ? (await this.currencies.findByCode(validated.toCurrency)).id
      : null;

    const rule = FeeRule.create(
      {
        id: ruleId,
        name: validated.name,
        operationKind: validated.operationKind,
        feeKind: validated.feeKind,
        calcMethod: validated.calcMethod,
        bps: validated.bps,
        fixedAmountMinor: validated.fixedAmountMinor,
        fixedCurrencyId: fixedCurrencyId ?? null,
        settlementMode: validated.settlementMode,
        accountingTreatment: validated.accountingTreatment,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
        fromCurrencyId,
        toCurrencyId,
        priority: validated.priority,
        isActive: validated.isActive,
        effectiveFrom: validated.effectiveFrom,
        effectiveTo: validated.effectiveTo,
        memo: validated.memo,
        metadata: validated.metadata,
      },
      this.runtime.now(),
    );
    await this.rulesStore.insertRule(rule.toSnapshot());

    this.runtime.log.info("Fee rule created", {
      ruleId,
      operationKind: validated.operationKind,
      feeKind: validated.feeKind,
      calcMethod: validated.calcMethod,
    });

    return ruleId;
  }
}
