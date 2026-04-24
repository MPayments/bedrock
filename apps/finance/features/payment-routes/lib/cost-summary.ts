import type {
  PaymentRouteAmountTotal,
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
} from "@bedrock/treasury/contracts";

export function aggregatePaymentRouteFeeTotals(
  fees: PaymentRouteCalculationFee[],
): PaymentRouteAmountTotal[] {
  const totals = new Map<string, bigint>();

  for (const fee of fees) {
    totals.set(
      fee.currencyId,
      (totals.get(fee.currencyId) ?? 0n) + BigInt(fee.amountMinor),
    );
  }

  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([currencyId, amountMinor]) => ({
      amountMinor: amountMinor.toString(),
      currencyId,
    }));
}

export function getPaymentRouteLegFeeTotals(
  calculation: PaymentRouteCalculation | null,
): PaymentRouteAmountTotal[] {
  if (!calculation) {
    return [];
  }

  return aggregatePaymentRouteFeeTotals(
    calculation.legs.flatMap((leg) => leg.fees),
  );
}

export function getPaymentRouteAdditionalFeeTotals(
  calculation: PaymentRouteCalculation | null,
): PaymentRouteAmountTotal[] {
  if (!calculation) {
    return [];
  }

  return aggregatePaymentRouteFeeTotals(calculation.additionalFees);
}

export function getPaymentRouteChargedFeeTotals(
  calculation: PaymentRouteCalculation | null,
): PaymentRouteAmountTotal[] {
  return calculation?.chargedFeeTotals ?? [];
}

export function getPaymentRouteInternalFeeTotals(
  calculation: PaymentRouteCalculation | null,
): PaymentRouteAmountTotal[] {
  return calculation?.internalFeeTotals ?? [];
}

export function getPaymentRouteClientTotalInMinor(
  calculation: PaymentRouteCalculation | null,
): string | null {
  return calculation?.clientTotalInMinor ?? null;
}

export function getPaymentRouteCostPriceInMinor(
  calculation: PaymentRouteCalculation | null,
): string | null {
  return calculation?.costPriceInMinor ?? null;
}

export function getPaymentRouteCleanAmountOutMinor(
  calculation: PaymentRouteCalculation | null,
): string | null {
  return calculation?.cleanAmountOutMinor ?? null;
}
