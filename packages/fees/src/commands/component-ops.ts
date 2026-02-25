import {
  adjustmentAggregateKey,
  componentAggregateKey,
  normalizeAdjustment,
  normalizeComponent,
} from "../internal/normalize";
import type {
  AdjustmentComponent,
  FeeComponent,
  MergeAdjustmentComponentsInput,
  MergeFeeComponentsInput,
  PartitionedAdjustmentComponents,
  PartitionedFeeComponents,
} from "../types";

export function createComponentOperationHandlers() {
  function aggregateFeeComponents(components: FeeComponent[]): FeeComponent[] {
    const grouped = new Map<string, FeeComponent>();

    for (const raw of components) {
      const component = normalizeComponent(raw);
      if (component.amountMinor === 0n) continue;

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
    const computed = (input.computed ?? []).map(normalizeComponent);
    const manual = (input.manual ?? []).map(normalizeComponent);

    const merged = [...computed, ...manual].filter(
      (component) => component.amountMinor > 0n,
    );

    if (input.aggregate === false) return merged;
    return aggregateFeeComponents(merged);
  }

  function partitionFeeComponents(
    components: FeeComponent[],
  ): PartitionedFeeComponents {
    const normalized = components.map(normalizeComponent);

    const inLedger: FeeComponent[] = [];
    const separatePaymentOrder: FeeComponent[] = [];

    for (const component of normalized) {
      if (component.settlementMode === "separate_payment_order") {
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
      const component = normalizeAdjustment(raw);
      if (component.amountMinor === 0n) continue;

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
    const computed = (input.computed ?? []).map(normalizeAdjustment);
    const manual = (input.manual ?? []).map(normalizeAdjustment);

    const merged = [...computed, ...manual].filter(
      (component) => component.amountMinor > 0n,
    );

    if (input.aggregate === false) return merged;
    return aggregateAdjustmentComponents(merged);
  }

  function partitionAdjustmentComponents(
    components: AdjustmentComponent[],
  ): PartitionedAdjustmentComponents {
    const normalized = components.map(normalizeAdjustment);

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
    mergeFeeComponents,
    aggregateFeeComponents,
    partitionFeeComponents,
    mergeAdjustmentComponents,
    aggregateAdjustmentComponents,
    partitionAdjustmentComponents,
  };
}
