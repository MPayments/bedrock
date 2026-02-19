import { makePlanKey } from "@bedrock/kernel";

import { FeeValidationError } from "../errors";
import {
    adjustmentAggregateKey,
    componentAggregateKey,
    normalizeAdjustment,
    normalizeComponent,
} from "../internal/normalize";
import type {
    AdjustmentComponent,
    AdjustmentTransferPlan,
    BuildAdjustmentTransferPlanInput,
    BuildFeeTransferPlanInput,
    FeeComponent,
    FeeTransferPlan,
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

        const merged = [...computed, ...manual].filter((component) => component.amountMinor > 0n);

        if (input.aggregate === false) return merged;
        return aggregateFeeComponents(merged);
    }

    function partitionFeeComponents(components: FeeComponent[]): PartitionedFeeComponents {
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

    function buildFeeTransferPlans(input: BuildFeeTransferPlanInput): FeeTransferPlan[] {
        const result: FeeTransferPlan[] = [];
        const includeZeroAmounts = Boolean(input.includeZeroAmounts);

        for (let idx = 0; idx < input.components.length; idx++) {
            const component = normalizeComponent(input.components[idx]!);

            if (component.settlementMode !== "in_ledger") continue;
            if (!includeZeroAmounts && component.amountMinor === 0n) continue;

            const posting = input.resolvePosting(component, idx + 1);

            const debitKey = posting.debitKey ?? component.debitAccountKey;
            const creditKey = posting.creditKey ?? component.creditAccountKey;

            if (!debitKey || !creditKey) {
                throw new FeeValidationError(
                    `Cannot build fee transfer plan for component ${component.id}: debit/credit account keys are missing`
                );
            }

            const planKey = input.makePlanKey
                ? input.makePlanKey(component, idx + 1)
                : makePlanKey("fee_component", {
                    idx: idx + 1,
                    id: component.id,
                    kind: component.kind,
                    currency: component.currency,
                    amount: component.amountMinor.toString(),
                    settlementMode: component.settlementMode,
                });

            result.push({
                planKey,
                debitKey,
                creditKey,
                currency: component.currency,
                amount: component.amountMinor,
                code: posting.code ?? component.transferCode,
                memo: posting.memo ?? component.memo ?? null,
                chain: input.chain ?? null,
                component,
            });
        }

        return result;
    }

    function aggregateAdjustmentComponents(components: AdjustmentComponent[]): AdjustmentComponent[] {
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

    function mergeAdjustmentComponents(input: MergeAdjustmentComponentsInput): AdjustmentComponent[] {
        const computed = (input.computed ?? []).map(normalizeAdjustment);
        const manual = (input.manual ?? []).map(normalizeAdjustment);

        const merged = [...computed, ...manual].filter((component) => component.amountMinor > 0n);

        if (input.aggregate === false) return merged;
        return aggregateAdjustmentComponents(merged);
    }

    function partitionAdjustmentComponents(components: AdjustmentComponent[]): PartitionedAdjustmentComponents {
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

    function buildAdjustmentTransferPlans(input: BuildAdjustmentTransferPlanInput): AdjustmentTransferPlan[] {
        const result: AdjustmentTransferPlan[] = [];
        const includeZeroAmounts = Boolean(input.includeZeroAmounts);

        for (let idx = 0; idx < input.components.length; idx++) {
            const component = normalizeAdjustment(input.components[idx]!);

            if (component.settlementMode !== "in_ledger") continue;
            if (!includeZeroAmounts && component.amountMinor === 0n) continue;

            const posting = input.resolvePosting(component, idx + 1);
            const debitKey = posting.debitKey ?? component.debitAccountKey;
            const creditKey = posting.creditKey ?? component.creditAccountKey;

            if (!debitKey || !creditKey) {
                throw new FeeValidationError(
                    `Cannot build adjustment transfer plan for component ${component.id}: debit/credit account keys are missing`
                );
            }

            const planKey = input.makePlanKey
                ? input.makePlanKey(component, idx + 1)
                : makePlanKey("adjustment_component", {
                    idx: idx + 1,
                    id: component.id,
                    kind: component.kind,
                    effect: component.effect,
                    currency: component.currency,
                    amount: component.amountMinor.toString(),
                    settlementMode: component.settlementMode,
                });

            result.push({
                planKey,
                debitKey,
                creditKey,
                currency: component.currency,
                amount: component.amountMinor,
                code: posting.code ?? component.transferCode,
                memo: posting.memo ?? component.memo ?? null,
                chain: input.chain ?? null,
                component,
            });
        }

        return result;
    }

    return {
        mergeFeeComponents,
        aggregateFeeComponents,
        partitionFeeComponents,
        buildFeeTransferPlans,
        mergeAdjustmentComponents,
        aggregateAdjustmentComponents,
        partitionAdjustmentComponents,
        buildAdjustmentTransferPlans,
    };
}
