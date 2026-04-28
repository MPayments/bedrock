import type { PaymentRouteDraft } from "@bedrock/treasury/contracts";

import type { PaymentRouteRequisiteWarning } from "./requisites";

export type PaymentRouteValidationStatus = "ok" | "warning" | "error";

export type PaymentRouteValidationCheck = {
  detail?: string;
  id: "currency_chain" | "requisites";
  status: PaymentRouteValidationStatus;
  title: string;
};

export const DEFAULT_MIN_MARGIN_BPS = 25;
export const DEFAULT_MAX_MARGIN_BPS = 1000;

export function getPaymentRouteValidationChecks(input: {
  calculation: unknown;
  draft: PaymentRouteDraft;
  maxMarginBps: number | null;
  minMarginBps: number | null;
  requisiteWarnings: PaymentRouteRequisiteWarning[];
}): PaymentRouteValidationCheck[] {
  const currencyChainOk =
    input.draft.legs.length > 0 &&
    input.draft.legs[0]!.fromCurrencyId === input.draft.currencyInId &&
    input.draft.legs[input.draft.legs.length - 1]!.toCurrencyId ===
      input.draft.currencyOutId &&
    input.draft.legs.every((leg, index) => {
      if (index === 0) {
        return true;
      }
      return (
        input.draft.legs[index - 1]!.toCurrencyId === leg.fromCurrencyId
      );
    });

  const currencyChainCheck: PaymentRouteValidationCheck = {
    id: "currency_chain",
    status: currencyChainOk ? "ok" : "warning",
    title: "Валюты связаны между шагами",
  };

  const requisiteStatus: PaymentRouteValidationStatus =
    input.requisiteWarnings.length === 0 ? "ok" : "warning";

  const requisitesCheck: PaymentRouteValidationCheck = {
    detail:
      input.requisiteWarnings.length > 0
        ? `Не выбраны реквизиты: ${input.requisiteWarnings.length}`
        : undefined,
    id: "requisites",
    status: requisiteStatus,
    title: "У связанных участников выбраны реквизиты",
  };

  return [currencyChainCheck, requisitesCheck];
}
