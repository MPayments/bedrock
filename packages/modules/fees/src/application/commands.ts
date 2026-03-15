import type {
  AdjustmentComponent,
  FeeComponent,
  MergeAdjustmentComponentsInput,
  MergeFeeComponentsInput,
  PartitionedAdjustmentComponents,
  PartitionedFeeComponents,
  SaveQuoteFeeComponentsInput,
  UpsertFeeRuleInput,
} from "../contracts";
import {
  adjustmentAggregateKey,
  componentAggregateKey,
  normalizeAdjustment,
  normalizeComponent,
  resolveAccountingTreatment,
} from "../domain/normalization";
import type { Transaction } from "@bedrock/platform/persistence";
import type { FeesServiceContext } from "./shared/context";
import {
  validateAdjustmentComponent,
  validateFeeComponent,
  validateSaveQuoteFeeComponentsInput,
  validateUpsertFeeRuleInput,
} from "./validation";

function normalizeValidatedFeeComponent(input: FeeComponent): FeeComponent {
  return normalizeComponent(validateFeeComponent(input));
}

function normalizeValidatedAdjustment(
  input: AdjustmentComponent,
): AdjustmentComponent {
  return normalizeAdjustment(validateAdjustmentComponent(input));
}

export function createFeesCommandHandlers(context: FeesServiceContext) {
  const {
    log,
    currenciesService,
    rulesRepository,
    quoteSnapshotsCommandRepository,
  } = context;

  async function upsertRule(input: UpsertFeeRuleInput): Promise<string> {
    const validated = validateUpsertFeeRuleInput(input);

    const fixedCurrencyId = validated.fixedCurrency
      ? (await currenciesService.findByCode(validated.fixedCurrency)).id
      : null;
    const fromCurrencyId = validated.fromCurrency
      ? (await currenciesService.findByCode(validated.fromCurrency)).id
      : null;
    const toCurrencyId = validated.toCurrency
      ? (await currenciesService.findByCode(validated.toCurrency)).id
      : null;

    const ruleId = await rulesRepository.insertRule({
      name: validated.name,
      operationKind: validated.operationKind,
      feeKind: validated.feeKind,
      calcMethod: validated.calcMethod,
      bps: validated.bps,
      fixedAmountMinor: validated.fixedAmountMinor,
      fixedCurrencyId,
      settlementMode: validated.settlementMode ?? "in_ledger",
      accountingTreatment: resolveAccountingTreatment(validated),
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      fromCurrencyId,
      toCurrencyId,
      priority: validated.priority ?? 100,
      isActive: validated.isActive ?? true,
      effectiveFrom: validated.effectiveFrom ?? new Date(),
      effectiveTo: validated.effectiveTo,
      memo: validated.memo,
      metadata: validated.metadata,
    });

    log.info("Fee rule persisted", {
      ruleId,
      operationKind: validated.operationKind,
      feeKind: validated.feeKind,
      calcMethod: validated.calcMethod,
    });

    return ruleId;
  }

  async function saveQuoteFeeComponents(
    input: SaveQuoteFeeComponentsInput,
    tx?: Transaction,
  ): Promise<void> {
    const validated = validateSaveQuoteFeeComponentsInput(input);

    if (!validated.components.length) {
      await quoteSnapshotsCommandRepository.replaceQuoteFeeComponents(
        { quoteId: validated.quoteId, components: [] },
        tx,
      );
      return;
    }

    const currencyCodes = [
      ...new Set(validated.components.map((component) => component.currency)),
    ];
    const currencyIdByCode = new Map<string, string>();

    await Promise.all(
      currencyCodes.map(async (code) => {
        const currency = await currenciesService.findByCode(code);
        currencyIdByCode.set(currency.code, currency.id);
      }),
    );

    await quoteSnapshotsCommandRepository.replaceQuoteFeeComponents(
      {
        quoteId: validated.quoteId,
        components: validated.components.map((raw, idx) => {
          const component = normalizeComponent(raw);

          return {
            quoteId: validated.quoteId,
            idx: idx + 1,
            ruleId: component.ruleId ?? null,
            kind: component.kind,
            currencyId: currencyIdByCode.get(component.currency)!,
            amountMinor: component.amountMinor,
            source: component.source,
            settlementMode: component.settlementMode ?? "in_ledger",
            memo: component.memo ?? null,
            metadata: component.metadata ?? null,
          };
        }),
      },
      tx,
    );
  }

  function aggregateFeeComponents(components: FeeComponent[]): FeeComponent[] {
    const grouped = new Map<string, FeeComponent>();

    for (const raw of components) {
      const component = normalizeValidatedFeeComponent(raw);
      if (component.amountMinor === 0n) {
        continue;
      }

      const key = componentAggregateKey(component);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, component);
        continue;
      }

      grouped.set(key, {
        ...existing,
        amountMinor: existing.amountMinor + component.amountMinor,
      });
    }

    return Array.from(grouped.values());
  }

  function mergeFeeComponents(input: MergeFeeComponentsInput): FeeComponent[] {
    const computed = (input.computed ?? []).map(normalizeValidatedFeeComponent);
    const manual = (input.manual ?? []).map(normalizeValidatedFeeComponent);

    const merged = [...computed, ...manual].filter(
      (component) => component.amountMinor > 0n,
    );

    if (input.aggregate === false) {
      return merged;
    }

    return aggregateFeeComponents(merged);
  }

  function partitionFeeComponents(
    components: FeeComponent[],
  ): PartitionedFeeComponents {
    const normalized = components.map(normalizeValidatedFeeComponent);

    const inLedger: FeeComponent[] = [];
    const separatePaymentOrder: FeeComponent[] = [];

    for (const component of normalized) {
      if (component.accountingTreatment !== "income") {
        separatePaymentOrder.push(component);
        continue;
      }

      inLedger.push(component);
    }

    return { inLedger, separatePaymentOrder };
  }

  function aggregateAdjustmentComponents(
    components: AdjustmentComponent[],
  ): AdjustmentComponent[] {
    const grouped = new Map<string, AdjustmentComponent>();

    for (const raw of components) {
      const component = normalizeValidatedAdjustment(raw);
      if (component.amountMinor === 0n) {
        continue;
      }

      const key = adjustmentAggregateKey(component);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, component);
        continue;
      }

      grouped.set(key, {
        ...existing,
        amountMinor: existing.amountMinor + component.amountMinor,
      });
    }

    return Array.from(grouped.values());
  }

  function mergeAdjustmentComponents(
    input: MergeAdjustmentComponentsInput,
  ): AdjustmentComponent[] {
    const computed = (input.computed ?? []).map(normalizeValidatedAdjustment);
    const manual = (input.manual ?? []).map(normalizeValidatedAdjustment);

    const merged = [...computed, ...manual].filter(
      (component) => component.amountMinor > 0n,
    );

    if (input.aggregate === false) {
      return merged;
    }

    return aggregateAdjustmentComponents(merged);
  }

  function partitionAdjustmentComponents(
    components: AdjustmentComponent[],
  ): PartitionedAdjustmentComponents {
    const normalized = components.map(normalizeValidatedAdjustment);

    const inLedger: AdjustmentComponent[] = [];
    const separatePaymentOrder: AdjustmentComponent[] = [];

    for (const component of normalized) {
      if (component.settlementMode === "separate_payment_order") {
        separatePaymentOrder.push(component);
        continue;
      }

      inLedger.push(component);
    }

    return { inLedger, separatePaymentOrder };
  }

  return {
    upsertRule,
    saveQuoteFeeComponents,
    mergeFeeComponents,
    aggregateFeeComponents,
    partitionFeeComponents,
    mergeAdjustmentComponents,
    aggregateAdjustmentComponents,
    partitionAdjustmentComponents,
  };
}
