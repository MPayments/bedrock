import { formatCurrencyAmount, getCurrencySymbol } from "../russian-language";
import type { DocumentLang } from "./types";
import { formatDateByLang, prune } from "./types";

export function assembleCalculationData(
  calculationData: Record<string, unknown>,
  lang: DocumentLang,
): Record<string, unknown> {
  const formattedDate = formatDateByLang(new Date(), lang);

  const formattedCalculationDate = calculationData.calculationTimestamp
    ? formatDateByLang(
        new Date(calculationData.calculationTimestamp as string | number),
        lang,
      )
    : formattedDate;

  const baseCurrency =
    (calculationData.baseCurrencyCode as string) || "RUB";
  const baseCurrencySymbol = getCurrencySymbol(baseCurrency);

  const raw: Record<string, unknown> = {
    calculationNumber: calculationData.id,
    currencyCode: calculationData.currencyCode,
    originalAmount: formatCurrencyAmount(
      parseFloat(String(calculationData.originalAmount)),
    ),
    feePercentage: calculationData.feePercentage,
    feeAmount: formatCurrencyAmount(
      parseFloat(String(calculationData.feeAmount)),
    ),
    totalAmount: formatCurrencyAmount(
      parseFloat(String(calculationData.totalAmount)),
    ),
    rateSource: calculationData.rateSource,
    rate: calculationData.rate,
    additionalExpenses: formatCurrencyAmount(
      parseFloat(String(calculationData.additionalExpenses)),
    ),
    baseCurrencyCode: baseCurrency,
    baseCurrencySymbol,
    feeAmountInBase: formatCurrencyAmount(
      parseFloat(String(calculationData.feeAmountInBase)),
    ),
    totalInBase: formatCurrencyAmount(
      parseFloat(String(calculationData.totalInBase)),
    ),
    additionalExpensesInBase: formatCurrencyAmount(
      parseFloat(String(calculationData.additionalExpensesInBase)),
    ),
    totalWithExpensesInBase: formatCurrencyAmount(
      parseFloat(String(calculationData.totalWithExpensesInBase)),
    ),
    calculationDate: formattedCalculationDate,
    date: formattedDate,
  };

  return prune(raw);
}
