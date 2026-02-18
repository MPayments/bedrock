import type { AdjustmentComponent, FeeComponent } from "../types";
import { validateAdjustmentComponent, validateFeeComponent } from "../validation";

export function normalizeComponent(input: FeeComponent): FeeComponent {
    const validated = validateFeeComponent(input);
    return {
        ...validated,
        settlementMode: validated.settlementMode ?? "in_ledger",
    };
}

export function normalizeAdjustment(input: AdjustmentComponent): AdjustmentComponent {
    const validated = validateAdjustmentComponent(input);
    return {
        ...validated,
        settlementMode: validated.settlementMode ?? "in_ledger",
    };
}

export function componentAggregateKey(component: FeeComponent): string {
    return [
        component.kind,
        component.currency,
        component.source,
        component.settlementMode ?? "in_ledger",
        component.debitAccountKey ?? "",
        component.creditAccountKey ?? "",
        String(component.transferCode ?? ""),
        component.memo ?? "",
    ].join("|");
}

export function adjustmentAggregateKey(component: AdjustmentComponent): string {
    return [
        component.kind,
        component.effect,
        component.currency,
        component.source,
        component.settlementMode ?? "in_ledger",
        component.debitAccountKey ?? "",
        component.creditAccountKey ?? "",
        String(component.transferCode ?? ""),
        component.memo ?? "",
    ].join("|");
}
