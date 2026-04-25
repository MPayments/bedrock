import type {
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
  PaymentRouteDraft,
} from "@bedrock/treasury/contracts";

import type { PaymentRouteRequisiteWarning } from "./requisites";

export type PaymentRouteValidationStatus = "ok" | "warning" | "error";

export type PaymentRouteValidationCheck = {
  detail?: string;
  id: "currency_chain" | "requisites" | "margin_policy";
  status: PaymentRouteValidationStatus;
  title: string;
};

export const DEFAULT_MIN_MARGIN_BPS = 25;
export const DEFAULT_MAX_MARGIN_BPS = 1000;

function formatBpsAsPercent(bps: number) {
  const whole = Math.trunc(bps / 100);
  const fraction = Math.abs(bps % 100);
  if (fraction === 0) {
    return whole.toString();
  }
  const fractionStr = fraction.toString().padStart(2, "0").replace(/0+$/, "");
  return `${whole},${fractionStr}`;
}

function sumRouteInputImpact(fees: PaymentRouteCalculationFee[]) {
  return fees.reduce(
    (acc, fee) => acc + BigInt(fee.routeInputImpactMinor),
    0n,
  );
}

function getPaymentRouteMarginMinor(
  calculation: PaymentRouteCalculation | null,
): { grossInMinor: bigint; marginInMinor: bigint } | null {
  if (!calculation) {
    return null;
  }

  const legFees = calculation.legs.flatMap((leg) => leg.fees);
  const chargedLegFees = legFees.filter((fee) => fee.chargeToCustomer);
  const chargedAdditionalFees = calculation.additionalFees.filter(
    (fee) => fee.chargeToCustomer,
  );
  const internalAdditionalFees = calculation.additionalFees.filter(
    (fee) => !fee.chargeToCustomer,
  );

  const chargedImpact = sumRouteInputImpact([
    ...chargedLegFees,
    ...chargedAdditionalFees,
  ]);
  const internalAdditionalImpact = sumRouteInputImpact(internalAdditionalFees);

  return {
    grossInMinor: BigInt(calculation.amountInMinor),
    marginInMinor: chargedImpact - internalAdditionalImpact,
  };
}

export function getPaymentRouteMarginBps(
  calculation: PaymentRouteCalculation | null,
): number | null {
  const summary = getPaymentRouteMarginMinor(calculation);

  if (!summary || summary.grossInMinor <= 0n) {
    return null;
  }

  const scaled =
    (summary.marginInMinor * 10000n + summary.grossInMinor / 2n) /
    summary.grossInMinor;

  return Number(scaled);
}

export function getPaymentRouteValidationChecks(input: {
  calculation: PaymentRouteCalculation | null;
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

  const minBound = input.minMarginBps ?? DEFAULT_MIN_MARGIN_BPS;
  const maxBound = input.maxMarginBps ?? DEFAULT_MAX_MARGIN_BPS;
  const currentBps = getPaymentRouteMarginBps(input.calculation);

  let marginStatus: PaymentRouteValidationStatus = "ok";
  let marginDetail: string;

  if (currentBps === null) {
    marginDetail = "Маржа будет проверена после расчёта";
  } else {
    const formatBps = (bps: number) => `${formatBpsAsPercent(bps)}%`;
    const currentLabel = formatBps(currentBps);
    const minLabel = formatBps(minBound);
    const maxLabel = formatBps(maxBound);

    if (currentBps < minBound || currentBps > maxBound) {
      marginStatus = "warning";
      marginDetail = `${minLabel} ≤ ${currentLabel} ≤ ${maxLabel}`;
    } else {
      marginDetail = `${currentLabel} (в пределах ${minLabel}–${maxLabel})`;
    }
  }

  const marginCheck: PaymentRouteValidationCheck = {
    detail: marginDetail,
    id: "margin_policy",
    status: marginStatus,
    title: "Маржа в пределах политики",
  };

  return [currencyChainCheck, requisitesCheck, marginCheck];
}
