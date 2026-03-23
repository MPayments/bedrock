import type {
  AdjustmentComponent,
  FeeAccountingTreatment,
  FeeComponent,
} from "./fee-types";

export function resolveAccountingTreatment(input: {
  accountingTreatment?: FeeAccountingTreatment;
  settlementMode?: FeeComponent["settlementMode"];
}): FeeAccountingTreatment {
  if (input.accountingTreatment) {
    return input.accountingTreatment;
  }

  if (input.settlementMode === "separate_payment_order") {
    return "pass_through";
  }

  return "income";
}

export function normalizeComponent(input: FeeComponent): FeeComponent {
  return {
    ...input,
    settlementMode: input.settlementMode ?? "in_ledger",
    accountingTreatment: resolveAccountingTreatment(input),
  };
}

export function normalizeAdjustment(
  input: AdjustmentComponent,
): AdjustmentComponent {
  return {
    ...input,
    settlementMode: input.settlementMode ?? "in_ledger",
  };
}

export function componentAggregateKey(component: FeeComponent) {
  return [
    component.kind,
    component.currency,
    component.source,
    component.settlementMode ?? "in_ledger",
    component.accountingTreatment ?? "income",
    component.memo ?? "",
  ].join("|");
}

export function adjustmentAggregateKey(component: AdjustmentComponent) {
  return [
    component.kind,
    component.effect,
    component.currency,
    component.source,
    component.settlementMode ?? "in_ledger",
    component.memo ?? "",
  ].join("|");
}
