import type {
  PaymentRouteAmountTotal,
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
} from "@bedrock/treasury/contracts";
import { mulDivFloor } from "@bedrock/shared/money/math";

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

export function getPaymentRouteTotalClientCostInMinor(
  calculation: PaymentRouteCalculation | null,
): string | null {
  if (!calculation) {
    return null;
  }

  let additionalCostInMinor = 0n;

  for (const fee of calculation.additionalFees) {
    if (fee.inputImpactCurrencyId !== calculation.currencyInId) {
      continue;
    }

    additionalCostInMinor += BigInt(fee.inputImpactMinor);
  }

  return (BigInt(calculation.amountInMinor) + additionalCostInMinor).toString();
}

export function getPaymentRoutePureAmountOutMinor(
  calculation: PaymentRouteCalculation | null,
): string | null {
  if (!calculation) {
    return null;
  }

  let rollingAmount = BigInt(calculation.amountInMinor);

  for (const leg of calculation.legs) {
    rollingAmount = mulDivFloor(
      rollingAmount,
      BigInt(leg.rateNum),
      BigInt(leg.rateDen),
    );
  }

  return rollingAmount.toString();
}
