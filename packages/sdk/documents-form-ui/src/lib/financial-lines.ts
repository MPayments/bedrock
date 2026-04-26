import {
  calculatePercentAmountMinor,
  parseSignedPercentToBps,
} from "@bedrock/plugin-documents-sdk/financial-lines";
import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";

import type {
  DocumentFormField,
  FinancialLineCalcMethod,
} from "./document-form-registry";

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

export function getFinancialLinePercentAmountPreview(input: {
  baseAmount: unknown;
  baseCurrency: unknown;
  percent: unknown;
}): string | null {
  const baseAmount =
    typeof input.baseAmount === "string" ? input.baseAmount.trim() : "";
  const baseCurrency =
    typeof input.baseCurrency === "string"
      ? input.baseCurrency.trim().toUpperCase()
      : "";
  const percent =
    typeof input.percent === "string" ? input.percent.trim() : "";

  if (baseAmount.length === 0 || baseCurrency.length === 0 || percent.length === 0) {
    return null;
  }

  try {
    const baseAmountMinor = BigInt(
      toMinorAmountString(baseAmount, baseCurrency, { requirePositive: true }),
    );
    const previewAmountMinor = calculatePercentAmountMinor(
      baseAmountMinor,
      parseSignedPercentToBps(percent),
    );

    return `${minorToAmountString(previewAmountMinor, {
      currency: baseCurrency,
    })} ${baseCurrency}`;
  } catch {
    return null;
  }
}
