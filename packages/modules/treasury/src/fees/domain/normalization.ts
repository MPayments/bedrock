import type {
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
