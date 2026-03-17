import type {
  DocumentFormField,
  FinancialLineCalcMethod,
} from "@/features/documents/lib/document-form-registry";

export type FinancialLineFormValue = {
  calcMethod?: string;
  bucket?: string;
  currency?: string;
  amount?: string;
  percent?: string;
  memo?: string;
};

export function resolveFinancialLineCalcMethod(input: {
  calcMethod: unknown;
  supportedCalcMethods: FinancialLineCalcMethod[];
}): FinancialLineCalcMethod {
  const value =
    typeof input.calcMethod === "string" ? input.calcMethod.trim() : "";

  if (
    value === "percent" &&
    input.supportedCalcMethods.includes("percent")
  ) {
    return "percent";
  }

  return "fixed";
}

export function createEmptyFinancialLineFormValue(
  field: Extract<DocumentFormField, { kind: "financialLines" }>,
): FinancialLineFormValue {
  return {
    calcMethod: resolveFinancialLineCalcMethod({
      calcMethod: "fixed",
      supportedCalcMethods: field.supportedCalcMethods,
    }),
    bucket: field.bucketOptions[0]?.value ?? "",
    currency: "",
    amount: "",
    percent: "",
    memo: "",
  };
}

export function getLockedFinancialLineCurrency(input: {
  calcMethod: FinancialLineCalcMethod;
  rowCurrency: unknown;
  baseCurrency: unknown;
}): string {
  if (input.calcMethod !== "percent") {
    return typeof input.rowCurrency === "string" ? input.rowCurrency : "";
  }

  return typeof input.baseCurrency === "string" ? input.baseCurrency : "";
}
