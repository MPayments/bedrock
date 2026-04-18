import type { CalculationDocumentData } from "../contracts";
import { formatCurrencyAmount, getCurrencySymbol } from "../russian-language";
import type { DocumentLang } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleCalculationData(
  calculationData: CalculationDocumentData,
  lang: DocumentLang,
): Record<string, unknown> {
  const formattedDate = formatDateByLang(new Date(), lang);

  const formattedCalculationDate = calculationData.calculationTimestamp
    ? formatDateByLang(
        new Date(calculationData.calculationTimestamp),
        lang,
      )
    : formattedDate;

  const baseCurrency = calculationData.baseCurrencyCode || "RUB";
  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);

  const raw: Record<string, unknown> = {
    calculationNumber: calculationData.id,
    currencyCode: calculationData.currencyCode,
    originalAmount: formatCurrencyAmount(calculationData.originalAmount),
    agreementFeePercentage: calculationData.agreementFeePercentage,
    agreementFeeAmount: formatCurrencyAmount(calculationData.agreementFeeAmount),
    quoteMarkupPercentage: calculationData.quoteMarkupPercentage,
    quoteMarkupAmount: formatCurrencyAmount(calculationData.quoteMarkupAmount),
    totalFeePercentage: calculationData.totalFeePercentage,
    totalFeeAmount: formatCurrencyAmount(calculationData.totalFeeAmount),
    totalAmount: formatCurrencyAmount(calculationData.totalAmount),
    rateSource: calculationData.rateSource,
    finalRate: calculationData.finalRate,
    rate: calculationData.rate,
    additionalExpenses: formatCurrencyAmount(calculationData.additionalExpenses),
    baseCurrencyCode: baseCurrency,
    baseCurrencySymbol,
    totalFeeAmountInBase: formatCurrencyAmount(
      calculationData.totalFeeAmountInBase,
    ),
    fixedFeeAmount: formatCurrencyAmount(calculationData.fixedFeeAmount),
    fixedFeeCurrencyCode: calculationData.fixedFeeCurrencyCode,
    totalInBase: formatCurrencyAmount(calculationData.totalInBase),
    additionalExpensesInBase: formatCurrencyAmount(
      calculationData.additionalExpensesInBase,
    ),
    totalWithExpensesInBase: formatCurrencyAmount(
      calculationData.totalWithExpensesInBase,
    ),
    calculationDate: formattedCalculationDate,
    date: formattedDate,
  };

  return prune(raw);
}
