import { mulDivFloor } from "@bedrock/shared/money/math";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { ComputedLeg, FxQuoteLegSourceKind } from "./quote-types";

interface RouteLegInput {
  fromCurrency: string;
  toCurrency: string;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef?: string;
  asOf?: Date;
  executionCounterpartyId?: string;
}

type AutoCrossQuoteInput = {
  fromCurrency: string;
  toCurrency: string;
  asOf: Date;
  anchor?: string;
};

type ExplicitRouteQuoteInput = {
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  asOf: Date;
  legs: RouteLegInput[];
};

export function buildAutoCrossTrace(
  input: AutoCrossQuoteInput,
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
  input: ExplicitRouteQuoteInput,
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
