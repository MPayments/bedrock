import type { AdjustmentComponent, FeeComponent } from "./types";
import {
  validateAdjustmentComponent,
  validateFeeComponent,
} from "./validation";

function resolveAccountingTreatment(input: {
  accountingTreatment?: FeeComponent["accountingTreatment"];
  settlementMode?: FeeComponent["settlementMode"];
}): FeeComponent["accountingTreatment"] {
  if (input.accountingTreatment) {
    return input.accountingTreatment;
  }

  if (input.settlementMode === "separate_payment_order") {
    return "pass_through";
  }

  return "income";
}

export function normalizeComponent(input: FeeComponent): FeeComponent {
  const validated = validateFeeComponent(input);
  return {
    ...validated,
    settlementMode: validated.settlementMode ?? "in_ledger",
    accountingTreatment: resolveAccountingTreatment(validated),
  };
}

export function normalizeAdjustment(
  input: AdjustmentComponent,
): AdjustmentComponent {
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
    component.accountingTreatment ?? "income",
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
    component.memo ?? "",
  ].join("|");
}
