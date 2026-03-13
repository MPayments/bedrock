import { mulDivFloor } from "@bedrock/kernel/math";
import { ValidationError } from "@bedrock/kernel/errors";

import { type QuoteInput } from "../validation";
import { type ComputedLeg } from "./types";

export function buildAutoCrossTrace(
  input: QuoteInput & { mode: "auto_cross"; anchor?: string },
  rateNum: bigint,
  rateDen: bigint,
) {
  return {
    version: "v1",
    mode: "auto_cross",
    anchor: input.anchor ?? "USD",
    summary: `${input.fromCurrency}/${input.toCurrency} cross quote`,
    steps: [
      {
        type: "cross_rate",
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rateNum: rateNum.toString(),
        rateDen: rateDen.toString(),
        asOf: input.asOf.toISOString(),
      },
    ],
  } as Record<string, unknown>;
}

export function computeExplicitRouteLegs(
  input: QuoteInput & { mode: "explicit_route" },
): ComputedLeg[] {
  if (input.legs[0]!.fromCurrency !== input.fromCurrency) {
    throw new ValidationError(
      "First leg fromCurrency must match quote fromCurrency",
    );
  }
  if (input.legs[input.legs.length - 1]!.toCurrency !== input.toCurrency) {
    throw new ValidationError(
      "Last leg toCurrency must match quote toCurrency",
    );
  }

  let rollingAmount = input.fromAmountMinor;
  const result: ComputedLeg[] = [];

  for (let idx = 0; idx < input.legs.length; idx++) {
    const leg = input.legs[idx]!;
    if (idx > 0) {
      const prev = input.legs[idx - 1]!;
      if (prev.toCurrency !== leg.fromCurrency) {
        throw new ValidationError(
          `Leg continuity mismatch at idx=${idx + 1}: ${prev.toCurrency} != ${leg.fromCurrency}`,
        );
      }
    }

    const toAmountMinor = mulDivFloor(rollingAmount, leg.rateNum, leg.rateDen);
    if (toAmountMinor <= 0n) {
      throw new ValidationError(
        `Computed leg toAmountMinor must be positive at idx=${idx + 1}`,
      );
    }

    result.push({
      idx: idx + 1,
      fromCurrency: leg.fromCurrency,
      toCurrency: leg.toCurrency,
      fromAmountMinor: rollingAmount,
      toAmountMinor,
      rateNum: leg.rateNum,
      rateDen: leg.rateDen,
      sourceKind: leg.sourceKind,
      sourceRef: leg.sourceRef ?? null,
      asOf: leg.asOf ?? input.asOf,
      executionCounterpartyId: leg.executionCounterpartyId ?? null,
    });

    rollingAmount = toAmountMinor;
  }

  return result;
}
