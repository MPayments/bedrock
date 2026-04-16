import { mulDivFloor, mulDivRoundHalfUp, parseDecimalToFraction } from "@bedrock/shared/money/math";

import type { CrossRate } from "../../rates/application/ports/rates.repository";
import type { CurrenciesPort } from "../../shared/application/external-ports";
import type {
  PaymentRouteAmountTotal,
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
  PaymentRouteCalculationLeg,
} from "../application/contracts/dto";
import type { PaymentRouteDraft, PaymentRouteFee } from "../application/contracts/zod";
import { ValidationError } from "../../errors";

type CrossRateLookup = (
  base: string,
  quote: string,
  asOf: Date,
  anchor?: string,
) => Promise<CrossRate>;

type CurrencyCodeCache = Map<string, string>;

function mergeTotals(
  totals: Map<string, bigint>,
  currencyId: string,
  amountMinor: bigint,
) {
  totals.set(currencyId, (totals.get(currencyId) ?? 0n) + amountMinor);
}

function createCalculationFee(input: {
  amountMinor: bigint;
  calculatedCurrencyId: string;
  fee: PaymentRouteDraft["legs"][number]["fees"][number];
  outputImpactCurrencyId: string;
  outputImpactMinor: bigint;
}): PaymentRouteCalculationFee {
  const base = {
    amountMinor: input.amountMinor.toString(),
    currencyId: input.calculatedCurrencyId,
    id: input.fee.id,
    label: input.fee.label,
    outputImpactCurrencyId: input.outputImpactCurrencyId,
    outputImpactMinor: input.outputImpactMinor.toString(),
  };

  if (input.fee.kind === "percent") {
    if (!input.fee.percentage) {
      throw new ValidationError("Percent fee requires percentage");
    }

    return {
      ...base,
      kind: "percent",
      percentage: input.fee.percentage,
    };
  }

  return {
    ...base,
    kind: "fixed",
  };
}

async function resolveCurrencyCode(
  currencies: CurrenciesPort,
  cache: CurrencyCodeCache,
  currencyId: string,
) {
  const existing = cache.get(currencyId);
  if (existing) {
    return existing;
  }

  const currency = await currencies.findById(currencyId);
  cache.set(currencyId, currency.code);
  return currency.code;
}

async function resolveRate(input: {
  asOf: Date;
  cache: CurrencyCodeCache;
  currencies: CurrenciesPort;
  fromCurrencyId: string;
  getCrossRate: CrossRateLookup;
  toCurrencyId: string;
}) {
  if (input.fromCurrencyId === input.toCurrencyId) {
    return {
      rateDen: 1n,
      rateNum: 1n,
      rateSource: "identity",
    };
  }

  const fromCode = await resolveCurrencyCode(
    input.currencies,
    input.cache,
    input.fromCurrencyId,
  );
  const toCode = await resolveCurrencyCode(
    input.currencies,
    input.cache,
    input.toCurrencyId,
  );
  const crossRate = await input.getCrossRate(fromCode, toCode, input.asOf, "USD");

  return {
    rateDen: crossRate.rateDen,
    rateNum: crossRate.rateNum,
    rateSource:
      crossRate.base === fromCode && crossRate.quote === toCode
        ? "market"
        : "derived",
  };
}

async function convertAmount(input: {
  amountMinor: bigint;
  asOf: Date;
  cache: CurrencyCodeCache;
  currencies: CurrenciesPort;
  fromCurrencyId: string;
  getCrossRate: CrossRateLookup;
  toCurrencyId: string;
}) {
  if (input.fromCurrencyId === input.toCurrencyId) {
    return input.amountMinor;
  }

  const { rateDen, rateNum } = await resolveRate({
    asOf: input.asOf,
    cache: input.cache,
    currencies: input.currencies,
    fromCurrencyId: input.fromCurrencyId,
    getCrossRate: input.getCrossRate,
    toCurrencyId: input.toCurrencyId,
  });

  return mulDivRoundHalfUp(input.amountMinor, rateNum, rateDen);
}

async function calculateFee(input: {
  asOf: Date;
  cache: CurrencyCodeCache;
  currencies: CurrenciesPort;
  fee: PaymentRouteFee;
  getCrossRate: CrossRateLookup;
  inputAmountMinor: bigint;
  inputCurrencyId: string;
  outputCurrencyId: string;
  outputRateDen: bigint;
  outputRateNum: bigint;
}): Promise<{
  amountMinor: bigint;
  currencyId: string;
  outputImpactCurrencyId: string;
  outputImpactMinor: bigint;
}> {
  if (input.fee.kind === "percent") {
    const percentageFraction = parseDecimalToFraction(input.fee.percentage!, {
      allowScientific: false,
    });
    const amountMinor = mulDivRoundHalfUp(
      input.inputAmountMinor,
      percentageFraction.num,
      percentageFraction.den * 100n,
    );
    const outputImpactMinor = mulDivRoundHalfUp(
      amountMinor,
      input.outputRateNum,
      input.outputRateDen,
    );

    return {
      amountMinor,
      currencyId: input.inputCurrencyId,
      outputImpactCurrencyId: input.outputCurrencyId,
      outputImpactMinor,
    };
  }

  const amountMinor = BigInt(input.fee.amountMinor!);
  const currencyId = input.fee.currencyId!;
  const outputImpactMinor = await convertAmount({
    amountMinor,
    asOf: input.asOf,
    cache: input.cache,
    currencies: input.currencies,
    fromCurrencyId: currencyId,
    getCrossRate: input.getCrossRate,
    toCurrencyId: input.outputCurrencyId,
  });

  return {
    amountMinor,
    currencyId,
    outputImpactCurrencyId: input.outputCurrencyId,
    outputImpactMinor,
  };
}

async function runForwardPreview(input: {
  amountInMinor: bigint;
  asOf: Date;
  currencies: CurrenciesPort;
  draft: PaymentRouteDraft;
  getCrossRate: CrossRateLookup;
}) {
  const currencyCache = new Map<string, string>();
  const feeTotals = new Map<string, bigint>();
  const legs: PaymentRouteCalculationLeg[] = [];
  let rollingAmount = input.amountInMinor;

  for (let index = 0; index < input.draft.legs.length; index += 1) {
    const leg = input.draft.legs[index]!;
    const { rateDen, rateNum, rateSource } = await resolveRate({
      asOf: input.asOf,
      cache: currencyCache,
      currencies: input.currencies,
      fromCurrencyId: leg.fromCurrencyId,
      getCrossRate: input.getCrossRate,
      toCurrencyId: leg.toCurrencyId,
    });
    const grossOutputMinor = mulDivFloor(rollingAmount, rateNum, rateDen);

    let totalOutputImpactMinor = 0n;
    const feeBreakdown: PaymentRouteCalculationFee[] = [];

    for (const fee of leg.fees) {
      const calculated = await calculateFee({
        asOf: input.asOf,
        cache: currencyCache,
        currencies: input.currencies,
        fee,
        getCrossRate: input.getCrossRate,
        inputAmountMinor: rollingAmount,
        inputCurrencyId: leg.fromCurrencyId,
        outputCurrencyId: leg.toCurrencyId,
        outputRateDen: rateDen,
        outputRateNum: rateNum,
      });

      totalOutputImpactMinor += calculated.outputImpactMinor;
      mergeTotals(feeTotals, calculated.currencyId, calculated.amountMinor);
      feeBreakdown.push(
        createCalculationFee({
          amountMinor: calculated.amountMinor,
          calculatedCurrencyId: calculated.currencyId,
          fee,
          outputImpactCurrencyId: calculated.outputImpactCurrencyId,
          outputImpactMinor: calculated.outputImpactMinor,
        }),
      );
    }

    if (totalOutputImpactMinor > grossOutputMinor) {
      throw new ValidationError(
        `Leg ${index + 1} fees exceed the converted amount`,
      );
    }

    const netOutputMinor = grossOutputMinor - totalOutputImpactMinor;

    legs.push({
      asOf: input.asOf.toISOString(),
      fees: feeBreakdown,
      fromCurrencyId: leg.fromCurrencyId,
      grossOutputMinor: grossOutputMinor.toString(),
      id: leg.id,
      idx: index + 1,
      inputAmountMinor: rollingAmount.toString(),
      kind: leg.kind,
      netOutputMinor: netOutputMinor.toString(),
      rateDen: rateDen.toString(),
      rateNum: rateNum.toString(),
      rateSource,
      toCurrencyId: leg.toCurrencyId,
    });

    rollingAmount = netOutputMinor;
  }

  const grossAmountOutMinor = rollingAmount;
  let netAmountOutMinor = grossAmountOutMinor;
  const additionalFees: PaymentRouteCalculationFee[] = [];

  for (const fee of input.draft.additionalFees) {
    const calculated = await calculateFee({
      asOf: input.asOf,
      cache: currencyCache,
      currencies: input.currencies,
      fee,
      getCrossRate: input.getCrossRate,
      inputAmountMinor: input.amountInMinor,
      inputCurrencyId: input.draft.currencyInId,
      outputCurrencyId: input.draft.currencyOutId,
      outputRateDen: input.amountInMinor,
      outputRateNum: grossAmountOutMinor,
    });

    if (calculated.outputImpactMinor > netAmountOutMinor) {
      throw new ValidationError("Additional fees exceed the route output amount");
    }

    netAmountOutMinor -= calculated.outputImpactMinor;
    mergeTotals(feeTotals, calculated.currencyId, calculated.amountMinor);
    additionalFees.push(
      createCalculationFee({
        amountMinor: calculated.amountMinor,
        calculatedCurrencyId: calculated.currencyId,
        fee,
        outputImpactCurrencyId: calculated.outputImpactCurrencyId,
        outputImpactMinor: calculated.outputImpactMinor,
      }),
    );
  }

  return {
    additionalFees,
    feeTotals,
    grossAmountOutMinor,
    legs,
    netAmountOutMinor,
  };
}

function serializeTotals(totals: Map<string, bigint>): PaymentRouteAmountTotal[] {
  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([currencyId, amountMinor]) => ({
      amountMinor: amountMinor.toString(),
      currencyId,
    }));
}

async function resolveMinimalInputForTargetOutput(input: {
  asOf: Date;
  currencies: CurrenciesPort;
  desiredAmountOutMinor: bigint;
  draft: PaymentRouteDraft;
  getCrossRate: CrossRateLookup;
}) {
  let low = 1n;
  let high = 1n;
  let highResult = await runForwardPreview({
    amountInMinor: high,
    asOf: input.asOf,
    currencies: input.currencies,
    draft: input.draft,
    getCrossRate: input.getCrossRate,
  });
  let guard = 0;

  while (highResult.netAmountOutMinor < input.desiredAmountOutMinor) {
    high *= 2n;
    highResult = await runForwardPreview({
      amountInMinor: high,
      asOf: input.asOf,
      currencies: input.currencies,
      draft: input.draft,
      getCrossRate: input.getCrossRate,
    });
    guard += 1;

    if (guard > 128) {
      throw new ValidationError(
        "Unable to satisfy the requested output with the current route",
      );
    }
  }

  let bestAmount = high;
  let bestResult = highResult;

  while (low <= high) {
    const middle = (low + high) / 2n;
    const result = await runForwardPreview({
      amountInMinor: middle,
      asOf: input.asOf,
      currencies: input.currencies,
      draft: input.draft,
      getCrossRate: input.getCrossRate,
    });

    if (result.netAmountOutMinor >= input.desiredAmountOutMinor) {
      bestAmount = middle;
      bestResult = result;
      if (middle === 0n) {
        break;
      }
      high = middle - 1n;
    } else {
      low = middle + 1n;
    }
  }

  return {
    amountInMinor: bestAmount,
    result: bestResult,
  };
}

export async function previewPaymentRoute(input: {
  asOf?: Date;
  currencies: CurrenciesPort;
  draft: PaymentRouteDraft;
  getCrossRate: CrossRateLookup;
}): Promise<PaymentRouteCalculation> {
  const asOf = input.asOf ?? new Date();

  if (input.draft.lockedSide === "currency_in") {
    const amountInMinor = BigInt(input.draft.amountInMinor);
    const result = await runForwardPreview({
      amountInMinor,
      asOf,
      currencies: input.currencies,
      draft: input.draft,
      getCrossRate: input.getCrossRate,
    });

    return {
      additionalFees: result.additionalFees,
      amountInMinor: amountInMinor.toString(),
      amountOutMinor: result.netAmountOutMinor.toString(),
      computedAt: asOf.toISOString(),
      currencyInId: input.draft.currencyInId,
      currencyOutId: input.draft.currencyOutId,
      feeTotals: serializeTotals(result.feeTotals),
      grossAmountOutMinor: result.grossAmountOutMinor.toString(),
      legs: result.legs,
      lockedSide: input.draft.lockedSide,
      netAmountOutMinor: result.netAmountOutMinor.toString(),
    };
  }

  const desiredAmountOutMinor = BigInt(input.draft.amountOutMinor);
  const resolved = await resolveMinimalInputForTargetOutput({
    asOf,
    currencies: input.currencies,
    desiredAmountOutMinor,
    draft: input.draft,
    getCrossRate: input.getCrossRate,
  });

  return {
    additionalFees: resolved.result.additionalFees,
    amountInMinor: resolved.amountInMinor.toString(),
    amountOutMinor: desiredAmountOutMinor.toString(),
    computedAt: asOf.toISOString(),
    currencyInId: input.draft.currencyInId,
    currencyOutId: input.draft.currencyOutId,
    feeTotals: serializeTotals(resolved.result.feeTotals),
    grossAmountOutMinor: resolved.result.grossAmountOutMinor.toString(),
    legs: resolved.result.legs,
    lockedSide: input.draft.lockedSide,
    netAmountOutMinor: resolved.result.netAmountOutMinor.toString(),
  };
}
