import type { useRouter } from "next/navigation";
import { FileText, Info, Wallet, Workflow } from "lucide-react";

import { formatRate } from "@/features/treasury/rates/lib/format";
import type {
  FinanceDealQuoteItem,
  FinanceDealWorkbench,
} from "@/features/treasury/deals/lib/queries";
import { formatMajorAmount } from "@/lib/format";

export type DealPageTab = "overview" | "pricing" | "documents" | "execution";

export const DEFAULT_DEAL_PAGE_TAB: DealPageTab = "execution";

export const DEAL_PAGE_TAB_META: Array<{
  icon: typeof Wallet;
  label: string;
  value: DealPageTab;
}> = [
  {
    icon: Workflow,
    label: "Исполнение",
    value: "execution",
  },
  {
    icon: Info,
    label: "Информация",
    value: "overview",
  },
  {
    icon: FileText,
    label: "Документы",
    value: "documents",
  },
  {
    icon: Wallet,
    label: "Котировки и расчет",
    value: "pricing",
  },
];

export function isDealPageTab(value: string | null): value is DealPageTab {
  return (
    value === "overview" ||
    value === "pricing" ||
    value === "documents" ||
    value === "execution"
  );
}

export function getDealTabHref(
  pathname: string,
  searchParams: { toString(): string },
  tab: DealPageTab,
) {
  const params = new URLSearchParams(searchParams.toString());

  if (tab === DEFAULT_DEAL_PAGE_TAB) {
    params.delete("tab");
  } else {
    params.set("tab", tab);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getQuoteCreationDisabledReason(deal: FinanceDealWorkbench) {
  if (!deal.pricing.quoteEligibility) {
    return "Котировка доступна только для сделок с обменом валют.";
  }

  if (!deal.actions.canCreateQuote) {
    return "Сейчас нельзя запросить котировку для этой сделки.";
  }

  if (!deal.pricing.quoteAmount) {
    return "У сделки нет суммы для запроса котировки.";
  }

  if (!deal.pricing.sourceCurrencyId) {
    return "У сделки не указана валюта списания.";
  }

  if (
    deal.pricing.quoteAmountSide === "target" &&
    !deal.pricing.targetCurrencyId
  ) {
    return "У сделки не указана валюта оплаты.";
  }

  return null;
}

export function getCalculationDisabledReason(deal: FinanceDealWorkbench) {
  if (deal.summary.calculationId) {
    return "По сделке уже привязан актуальный расчет.";
  }

  if (!deal.acceptedQuote) {
    return "Сначала примите котировку.";
  }

  if (deal.acceptedQuote.quoteStatus !== "active") {
    return "Создать расчет можно только по действующей принятой котировке.";
  }

  if (!deal.actions.canCreateCalculation) {
    return "Создать расчет сейчас нельзя.";
  }

  return null;
}

export function formatQuoteAmountsSummary(
  quote: Pick<
    FinanceDealQuoteItem,
    "fromAmount" | "fromCurrency" | "toAmount" | "toCurrency"
  >,
) {
  return `${quote.fromAmount} ${quote.fromCurrency} → ${quote.toAmount} ${quote.toCurrency}`;
}

export function formatQuoteRateSummary(
  quote: Pick<
    FinanceDealQuoteItem,
    "fromCurrency" | "rateDen" | "rateNum" | "toCurrency"
  >,
) {
  return `${formatMajorAmount(formatRate(quote.rateNum, quote.rateDen))} ${
    quote.toCurrency
  } за 1 ${quote.fromCurrency}`;
}

export function getAcceptedQuoteDetails(deal: FinanceDealWorkbench) {
  const acceptedQuoteId = deal.acceptedQuote?.quoteId;

  if (!acceptedQuoteId) {
    return null;
  }

  if (deal.acceptedQuoteDetails?.id === acceptedQuoteId) {
    return deal.acceptedQuoteDetails;
  }

  return (
    deal.quoteHistory.find((quote) => quote.id === acceptedQuoteId) ?? null
  );
}

export function getQuoteItemsForDisplay(deal: FinanceDealWorkbench) {
  const acceptedQuoteDetails = getAcceptedQuoteDetails(deal);

  if (deal.quoteHistory.length === 0) {
    return acceptedQuoteDetails ? [acceptedQuoteDetails] : [];
  }

  if (
    acceptedQuoteDetails &&
    !deal.quoteHistory.some((quote) => quote.id === acceptedQuoteDetails.id)
  ) {
    return [acceptedQuoteDetails, ...deal.quoteHistory];
  }

  return deal.quoteHistory;
}

export function findQuoteDetailsById(
  deal: FinanceDealWorkbench,
  quoteId: string | null | undefined,
) {
  if (!quoteId) {
    return null;
  }

  if (deal.acceptedQuoteDetails?.id === quoteId) {
    return deal.acceptedQuoteDetails;
  }

  return deal.quoteHistory.find((quote) => quote.id === quoteId) ?? null;
}

export function refreshPage(router: ReturnType<typeof useRouter>) {
  router.refresh();
}
