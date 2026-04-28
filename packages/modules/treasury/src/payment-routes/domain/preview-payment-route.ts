import {
  mulDivFloor,
  mulDivRoundHalfUp,
  parseDecimalToFraction,
} from "@bedrock/shared/money/math";

import type {
  PaymentRouteAmountTotal,
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
  PaymentRouteCalculationLeg,
  PaymentRouteDraft,
  PaymentRouteExecutionCostLine,
  PaymentRouteExecutionCostTreatment,
  PaymentRouteFeeApplication,
  PaymentRouteFee,
} from "./model";
import { ValidationError } from "../../errors";
import type { CrossRate } from "../../rates/domain/model";

type CrossRateLookup = (
  base: string,
  quote: string,
  asOf: Date,
  anchor?: string,
) => Promise<CrossRate>;

interface CurrencyLookup {
  findById(currencyId: string): Promise<{ code: string }>;
}

type CurrencyCodeCache = Map<string, string>;

interface CalculatedFee {
  amountMinor: bigint;
  currencyId: string;
  inputImpactCurrencyId: string;
  inputImpactMinor: bigint;
  outputImpactCurrencyId: string;
  outputImpactMinor: bigint;
  routeInputImpactMinor: bigint;
}

interface ForwardPreviewResult {
  additionalFees: PaymentRouteCalculationFee[];
  benchmarkPrincipalInMinor: bigint;
  cleanAmountOutMinor: bigint;
  costPriceInMinor: bigint;
  deductedExecutionCostMinor: bigint;
  embeddedExecutionCostMinor: bigint;
  executionCostLines: PaymentRouteExecutionCostLine[];
  executionPrincipalInMinor: bigint;
  feeTotals: Map<string, bigint>;
  grossAmountOutMinor: bigint;
  internalFeeTotals: Map<string, bigint>;
  legs: PaymentRouteCalculationLeg[];
  netAmountOutMinor: bigint;
  separateExecutionCostMinor: bigint;
}

function mergeTotals(
  totals: Map<string, bigint>,
  currencyId: string,
  amountMinor: bigint,
) {
  totals.set(currencyId, (totals.get(currencyId) ?? 0n) + amountMinor);
}

function createCalculationFee(input: {
  amountMinor: bigint;
  application: PaymentRouteFeeApplication;
  calculatedCurrencyId: string;
  fee: PaymentRouteDraft["legs"][number]["fees"][number];
  inputImpactCurrencyId: string;
  inputImpactMinor: bigint;
  outputImpactCurrencyId: string;
  outputImpactMinor: bigint;
  routeInputImpactMinor: bigint;
}): PaymentRouteCalculationFee {
  const base = {
    amountMinor: input.amountMinor.toString(),
    application: input.application,
    currencyId: input.calculatedCurrencyId,
    id: input.fee.id,
    inputImpactCurrencyId: input.inputImpactCurrencyId,
    inputImpactMinor: input.inputImpactMinor.toString(),
    label: input.fee.label,
    outputImpactCurrencyId: input.outputImpactCurrencyId,
    outputImpactMinor: input.outputImpactMinor.toString(),
    routeInputImpactMinor: input.routeInputImpactMinor.toString(),
  };

  if (input.fee.kind === "fixed") {
    return {
      ...base,
      kind: "fixed",
    };
  }

  if (!input.fee.percentage) {
    throw new ValidationError(`${input.fee.kind} fee requires percentage`);
  }

  return {
    ...base,
    kind: input.fee.kind,
    percentage: input.fee.percentage,
  };
}

function resolveFeeApplication(
  fee: PaymentRouteFee,
  location: "additional" | "leg",
): PaymentRouteFeeApplication {
  if (location === "additional") {
    if (fee.application && fee.application !== "separate_charge") {
      throw new ValidationError("Additional route fees must use separate_charge");
    }

    return "separate_charge";
  }

  if (fee.kind === "fx_spread") {
    return "embedded_in_rate";
  }

  if (fee.application === "embedded_in_rate") {
    throw new ValidationError(
      "embedded_in_rate application is only supported for fx_spread",
    );
  }

  return fee.application ?? "deducted_from_flow";
}

function resolveExecutionCostTreatment(
  application: PaymentRouteFeeApplication,
): PaymentRouteExecutionCostTreatment {
  switch (application) {
    case "embedded_in_rate":
      return "execution_spread";
    case "deducted_from_flow":
      return "flow_deduction";
    case "separate_charge":
      return "separate_expense";
  }
}

function createExecutionCostLine(input: {
  amountMinor: bigint;
  application: PaymentRouteFeeApplication;
  calculatedCurrencyId: string;
  fee: PaymentRouteFee;
  inputImpactCurrencyId: string;
  inputImpactMinor: bigint;
  location: "additional" | "leg";
  outputImpactCurrencyId: string;
  outputImpactMinor: bigint;
  routeInputImpactMinor: bigint;
}): PaymentRouteExecutionCostLine {
  return {
    amountMinor: input.amountMinor.toString(),
    application: input.application,
    currencyId: input.calculatedCurrencyId,
    id: input.fee.id,
    inputImpactCurrencyId: input.inputImpactCurrencyId,
    inputImpactMinor: input.inputImpactMinor.toString(),
    kind: input.fee.kind,
    label: input.fee.label,
    location: input.location,
    outputImpactCurrencyId: input.outputImpactCurrencyId,
    outputImpactMinor: input.outputImpactMinor.toString(),
    routeInputImpactMinor: input.routeInputImpactMinor.toString(),
    treatment: resolveExecutionCostTreatment(input.application),
  };
}

async function resolveCurrencyCode(
  currencies: CurrencyLookup,
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
  currencies: CurrencyLookup;
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
  currencies: CurrencyLookup;
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
  currencies: CurrencyLookup;
  fee: PaymentRouteFee;
  getCrossRate: CrossRateLookup;
  grossBaseMinor: bigint;
  inputCurrencyId: string;
  netBaseMinor: bigint;
  outputCurrencyId: string;
  outputRateDen: bigint;
  outputRateNum: bigint;
  routeInputCurrencyId: string;
}): Promise<CalculatedFee> {
  if (
    input.fee.kind === "gross_percent" ||
    input.fee.kind === "net_percent"
  ) {
    const percentageFraction = parseDecimalToFraction(input.fee.percentage!, {
      allowScientific: false,
    });
    const base =
      input.fee.kind === "net_percent"
        ? input.netBaseMinor > 0n
          ? input.netBaseMinor
          : 0n
        : input.grossBaseMinor;
    const amountMinor = mulDivRoundHalfUp(
      base,
      percentageFraction.num,
      percentageFraction.den * 100n,
    );
    const outputImpactMinor = mulDivRoundHalfUp(
      amountMinor,
      input.outputRateNum,
      input.outputRateDen,
    );
    const routeInputImpactMinor = await convertAmount({
      amountMinor,
      asOf: input.asOf,
      cache: input.cache,
      currencies: input.currencies,
      fromCurrencyId: input.inputCurrencyId,
      getCrossRate: input.getCrossRate,
      toCurrencyId: input.routeInputCurrencyId,
    });

    return {
      amountMinor,
      currencyId: input.inputCurrencyId,
      inputImpactCurrencyId: input.inputCurrencyId,
      inputImpactMinor: amountMinor,
      outputImpactCurrencyId: input.outputCurrencyId,
      outputImpactMinor,
      routeInputImpactMinor,
    };
  }

  if (input.fee.kind === "fixed") {
    const amountMinor = BigInt(input.fee.amountMinor!);
    const currencyId = input.fee.currencyId!;
    const inputImpactMinor = await convertAmount({
      amountMinor,
      asOf: input.asOf,
      cache: input.cache,
      currencies: input.currencies,
      fromCurrencyId: currencyId,
      getCrossRate: input.getCrossRate,
      toCurrencyId: input.inputCurrencyId,
    });
    const outputImpactMinor = await convertAmount({
      amountMinor,
      asOf: input.asOf,
      cache: input.cache,
      currencies: input.currencies,
      fromCurrencyId: currencyId,
      getCrossRate: input.getCrossRate,
      toCurrencyId: input.outputCurrencyId,
    });
    const routeInputImpactMinor = await convertAmount({
      amountMinor,
      asOf: input.asOf,
      cache: input.cache,
      currencies: input.currencies,
      fromCurrencyId: currencyId,
      getCrossRate: input.getCrossRate,
      toCurrencyId: input.routeInputCurrencyId,
    });

    return {
      amountMinor,
      currencyId,
      inputImpactCurrencyId: input.inputCurrencyId,
      inputImpactMinor,
      outputImpactCurrencyId: input.outputCurrencyId,
      outputImpactMinor,
      routeInputImpactMinor,
    };
  }

  throw new ValidationError(
    `Unsupported fee kind in calculateFee: ${input.fee.kind}`,
  );
}

interface FxSpreadCalculation extends CalculatedFee {
  newGrossOutputMinor: bigint;
}

async function calculateFxSpread(input: {
  asOf: Date;
  baseGrossOutputMinor: bigint;
  cache: CurrencyCodeCache;
  currencies: CurrencyLookup;
  fee: PaymentRouteFee;
  fromCurrencyId: string;
  getCrossRate: CrossRateLookup;
  routeInputCurrencyId: string;
  toCurrencyId: string;
}): Promise<FxSpreadCalculation> {
  if (!input.fee.percentage) {
    throw new ValidationError("fx_spread fee requires percentage");
  }

  const fraction = parseDecimalToFraction(input.fee.percentage, {
    allowScientific: false,
  });
  const spreadAmount = mulDivRoundHalfUp(
    input.baseGrossOutputMinor,
    fraction.num,
    fraction.den * 100n,
  );
  const newGrossOutputMinor = input.baseGrossOutputMinor - spreadAmount;

  const inputImpactMinor = await convertAmount({
    amountMinor: spreadAmount,
    asOf: input.asOf,
    cache: input.cache,
    currencies: input.currencies,
    fromCurrencyId: input.toCurrencyId,
    getCrossRate: input.getCrossRate,
    toCurrencyId: input.fromCurrencyId,
  });
  const routeInputImpactMinor = await convertAmount({
    amountMinor: spreadAmount,
    asOf: input.asOf,
    cache: input.cache,
    currencies: input.currencies,
    fromCurrencyId: input.toCurrencyId,
    getCrossRate: input.getCrossRate,
    toCurrencyId: input.routeInputCurrencyId,
  });

  return {
    amountMinor: spreadAmount,
    currencyId: input.toCurrencyId,
    inputImpactCurrencyId: input.fromCurrencyId,
    inputImpactMinor,
    newGrossOutputMinor,
    outputImpactCurrencyId: input.toCurrencyId,
    outputImpactMinor: spreadAmount,
    routeInputImpactMinor,
  };
}

async function runForwardPreview(input: {
  amountInMinor: bigint;
  asOf: Date;
  currencies: CurrencyLookup;
  draft: PaymentRouteDraft;
  getCrossRate: CrossRateLookup;
}): Promise<ForwardPreviewResult> {
  const currencyCache = new Map<string, string>();
  const feeTotals = new Map<string, bigint>();
  const internalFeeTotals = new Map<string, bigint>();
  const executionCostLines: PaymentRouteExecutionCostLine[] = [];
  const legs: PaymentRouteCalculationLeg[] = [];
  let cleanRollingAmount = input.amountInMinor;
  let rollingAmount = input.amountInMinor;
  let costPriceInMinor = input.amountInMinor;
  let deductedExecutionCostMinor = 0n;
  let embeddedExecutionCostMinor = 0n;
  let separateExecutionCostMinor = 0n;

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
    const cleanOutputMinor = mulDivFloor(cleanRollingAmount, rateNum, rateDen);
    let grossOutputMinor = mulDivFloor(rollingAmount, rateNum, rateDen);

    let deductedOutputImpactMinor = 0n;
    let netBaseMinor = rollingAmount;
    const feeBreakdown: PaymentRouteCalculationFee[] = [];

    for (const fee of leg.fees) {
      const application = resolveFeeApplication(fee, "leg");

      if (fee.kind === "fx_spread") {
        const spread = await calculateFxSpread({
          asOf: input.asOf,
          baseGrossOutputMinor: grossOutputMinor,
          cache: currencyCache,
          currencies: input.currencies,
          fee,
          fromCurrencyId: leg.fromCurrencyId,
          getCrossRate: input.getCrossRate,
          routeInputCurrencyId: input.draft.currencyInId,
          toCurrencyId: leg.toCurrencyId,
        });

        grossOutputMinor = spread.newGrossOutputMinor;
        embeddedExecutionCostMinor += spread.routeInputImpactMinor;
        mergeTotals(feeTotals, spread.currencyId, spread.amountMinor);

        feeBreakdown.push(
          createCalculationFee({
            amountMinor: spread.amountMinor,
            application,
            calculatedCurrencyId: spread.currencyId,
            fee,
            inputImpactCurrencyId: spread.inputImpactCurrencyId,
            inputImpactMinor: spread.inputImpactMinor,
            outputImpactCurrencyId: spread.outputImpactCurrencyId,
            outputImpactMinor: spread.outputImpactMinor,
            routeInputImpactMinor: spread.routeInputImpactMinor,
          }),
        );
        executionCostLines.push(
          createExecutionCostLine({
            amountMinor: spread.amountMinor,
            application,
            calculatedCurrencyId: spread.currencyId,
            fee,
            inputImpactCurrencyId: spread.inputImpactCurrencyId,
            inputImpactMinor: spread.inputImpactMinor,
            location: "leg",
            outputImpactCurrencyId: spread.outputImpactCurrencyId,
            outputImpactMinor: spread.outputImpactMinor,
            routeInputImpactMinor: spread.routeInputImpactMinor,
          }),
        );
        continue;
      }

      const calculated = await calculateFee({
        asOf: input.asOf,
        cache: currencyCache,
        currencies: input.currencies,
        fee,
        getCrossRate: input.getCrossRate,
        grossBaseMinor: rollingAmount,
        inputCurrencyId: leg.fromCurrencyId,
        netBaseMinor,
        outputCurrencyId: leg.toCurrencyId,
        outputRateDen: rateDen,
        outputRateNum: rateNum,
        routeInputCurrencyId: input.draft.currencyInId,
      });

      if (application === "deducted_from_flow") {
        netBaseMinor -= calculated.inputImpactMinor;
        deductedOutputImpactMinor += calculated.outputImpactMinor;
        deductedExecutionCostMinor += calculated.routeInputImpactMinor;
      }

      if (application === "separate_charge") {
        costPriceInMinor += calculated.routeInputImpactMinor;
        separateExecutionCostMinor += calculated.routeInputImpactMinor;
      }

      mergeTotals(feeTotals, calculated.currencyId, calculated.amountMinor);
      mergeTotals(internalFeeTotals, calculated.currencyId, calculated.amountMinor);

      feeBreakdown.push(
        createCalculationFee({
          amountMinor: calculated.amountMinor,
          application,
          calculatedCurrencyId: calculated.currencyId,
          fee,
          inputImpactCurrencyId: calculated.inputImpactCurrencyId,
          inputImpactMinor: calculated.inputImpactMinor,
          outputImpactCurrencyId: calculated.outputImpactCurrencyId,
          outputImpactMinor: calculated.outputImpactMinor,
          routeInputImpactMinor: calculated.routeInputImpactMinor,
        }),
      );
      executionCostLines.push(
        createExecutionCostLine({
          amountMinor: calculated.amountMinor,
          application,
          calculatedCurrencyId: calculated.currencyId,
          fee,
          inputImpactCurrencyId: calculated.inputImpactCurrencyId,
          inputImpactMinor: calculated.inputImpactMinor,
          location: "leg",
          outputImpactCurrencyId: calculated.outputImpactCurrencyId,
          outputImpactMinor: calculated.outputImpactMinor,
          routeInputImpactMinor: calculated.routeInputImpactMinor,
        }),
      );
    }

    if (deductedOutputImpactMinor > grossOutputMinor) {
      throw new ValidationError(
        `Leg ${index + 1} fees exceed the converted amount`,
      );
    }

    const netOutputMinor = grossOutputMinor - deductedOutputImpactMinor;

    legs.push({
      asOf: input.asOf.toISOString(),
      fees: feeBreakdown,
      fromCurrencyId: leg.fromCurrencyId,
      grossOutputMinor: grossOutputMinor.toString(),
      id: leg.id,
      idx: index + 1,
      inputAmountMinor: rollingAmount.toString(),
      netOutputMinor: netOutputMinor.toString(),
      rateDen: rateDen.toString(),
      rateNum: rateNum.toString(),
      rateSource,
      toCurrencyId: leg.toCurrencyId,
    });

    cleanRollingAmount = cleanOutputMinor;
    rollingAmount = netOutputMinor;
  }

  const cleanAmountOutMinor = cleanRollingAmount;
  const grossAmountOutMinor = rollingAmount;
  const netAmountOutMinor = grossAmountOutMinor;
  const additionalFees: PaymentRouteCalculationFee[] = [];
  let additionalNetBaseMinor = input.amountInMinor;

  for (const fee of input.draft.additionalFees) {
    const application = resolveFeeApplication(fee, "additional");
    const calculated = await calculateFee({
      asOf: input.asOf,
      cache: currencyCache,
      currencies: input.currencies,
      fee,
      getCrossRate: input.getCrossRate,
      grossBaseMinor: input.amountInMinor,
      inputCurrencyId: input.draft.currencyInId,
      netBaseMinor: additionalNetBaseMinor,
      outputCurrencyId: input.draft.currencyOutId,
      outputRateDen: input.amountInMinor,
      outputRateNum: grossAmountOutMinor,
      routeInputCurrencyId: input.draft.currencyInId,
    });

    additionalNetBaseMinor -= calculated.inputImpactMinor;

    costPriceInMinor += calculated.routeInputImpactMinor;
    separateExecutionCostMinor += calculated.routeInputImpactMinor;
    mergeTotals(feeTotals, calculated.currencyId, calculated.amountMinor);
    mergeTotals(internalFeeTotals, calculated.currencyId, calculated.amountMinor);

    additionalFees.push(
      createCalculationFee({
        amountMinor: calculated.amountMinor,
        application,
        calculatedCurrencyId: calculated.currencyId,
        fee,
        inputImpactCurrencyId: calculated.inputImpactCurrencyId,
        inputImpactMinor: calculated.inputImpactMinor,
        outputImpactCurrencyId: calculated.outputImpactCurrencyId,
        outputImpactMinor: calculated.outputImpactMinor,
        routeInputImpactMinor: calculated.routeInputImpactMinor,
      }),
    );
    executionCostLines.push(
      createExecutionCostLine({
        amountMinor: calculated.amountMinor,
        application,
        calculatedCurrencyId: calculated.currencyId,
        fee,
        inputImpactCurrencyId: calculated.inputImpactCurrencyId,
        inputImpactMinor: calculated.inputImpactMinor,
        location: "additional",
        outputImpactCurrencyId: calculated.outputImpactCurrencyId,
        outputImpactMinor: calculated.outputImpactMinor,
        routeInputImpactMinor: calculated.routeInputImpactMinor,
      }),
    );
  }

  const embeddedAndDeductedCostMinor =
    embeddedExecutionCostMinor + deductedExecutionCostMinor;
  const benchmarkPrincipalInMinor =
    input.amountInMinor > embeddedAndDeductedCostMinor
      ? input.amountInMinor - embeddedAndDeductedCostMinor
      : 0n;

  return {
    additionalFees,
    benchmarkPrincipalInMinor,
    cleanAmountOutMinor,
    costPriceInMinor,
    deductedExecutionCostMinor,
    embeddedExecutionCostMinor,
    executionCostLines,
    executionPrincipalInMinor: input.amountInMinor,
    feeTotals,
    grossAmountOutMinor,
    internalFeeTotals,
    legs,
    netAmountOutMinor,
    separateExecutionCostMinor,
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

function isInsufficientInputPreviewError(error: unknown) {
  return (
    error instanceof ValidationError &&
    error.message.includes("fees exceed the converted amount")
  );
}

async function tryRunForwardPreviewForTargetSearch(input: {
  amountInMinor: bigint;
  asOf: Date;
  currencies: CurrencyLookup;
  draft: PaymentRouteDraft;
  getCrossRate: CrossRateLookup;
}) {
  try {
    return await runForwardPreview(input);
  } catch (error) {
    if (isInsufficientInputPreviewError(error)) {
      return null;
    }

    throw error;
  }
}

async function resolveMinimalInputForTargetOutput(input: {
  asOf: Date;
  currencies: CurrencyLookup;
  desiredAmountOutMinor: bigint;
  draft: PaymentRouteDraft;
  getCrossRate: CrossRateLookup;
}) {
  let low = 1n;
  let high = 1n;
  let highResult = await tryRunForwardPreviewForTargetSearch({
    amountInMinor: high,
    asOf: input.asOf,
    currencies: input.currencies,
    draft: input.draft,
    getCrossRate: input.getCrossRate,
  });
  let guard = 0;

  while (
    !highResult ||
    highResult.netAmountOutMinor < input.desiredAmountOutMinor
  ) {
    high *= 2n;
    highResult = await tryRunForwardPreviewForTargetSearch({
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

  if (!highResult) {
    throw new ValidationError(
      "Unable to satisfy the requested output with the current route",
    );
  }

  let bestAmount = high;
  let bestResult = highResult;

  while (low <= high) {
    const middle = (low + high) / 2n;
    const result = await tryRunForwardPreviewForTargetSearch({
      amountInMinor: middle,
      asOf: input.asOf,
      currencies: input.currencies,
      draft: input.draft,
      getCrossRate: input.getCrossRate,
    });

    if (result && result.netAmountOutMinor >= input.desiredAmountOutMinor) {
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
  currencies: CurrencyLookup;
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
      benchmarkPrincipalInMinor: result.benchmarkPrincipalInMinor.toString(),
      cleanAmountOutMinor: result.cleanAmountOutMinor.toString(),
      computedAt: asOf.toISOString(),
      costPriceInMinor: result.costPriceInMinor.toString(),
      currencyInId: input.draft.currencyInId,
      currencyOutId: input.draft.currencyOutId,
      deductedExecutionCostMinor: result.deductedExecutionCostMinor.toString(),
      embeddedExecutionCostMinor: result.embeddedExecutionCostMinor.toString(),
      executionCostLines: result.executionCostLines,
      executionPrincipalInMinor: result.executionPrincipalInMinor.toString(),
      feeTotals: serializeTotals(result.feeTotals),
      grossAmountOutMinor: result.grossAmountOutMinor.toString(),
      internalFeeTotals: serializeTotals(result.internalFeeTotals),
      legs: result.legs,
      lockedSide: input.draft.lockedSide,
      netAmountOutMinor: result.netAmountOutMinor.toString(),
      separateExecutionCostMinor: result.separateExecutionCostMinor.toString(),
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
    amountOutMinor: resolved.result.netAmountOutMinor.toString(),
    benchmarkPrincipalInMinor:
      resolved.result.benchmarkPrincipalInMinor.toString(),
    cleanAmountOutMinor: resolved.result.cleanAmountOutMinor.toString(),
    computedAt: asOf.toISOString(),
    costPriceInMinor: resolved.result.costPriceInMinor.toString(),
    currencyInId: input.draft.currencyInId,
    currencyOutId: input.draft.currencyOutId,
    deductedExecutionCostMinor:
      resolved.result.deductedExecutionCostMinor.toString(),
    embeddedExecutionCostMinor:
      resolved.result.embeddedExecutionCostMinor.toString(),
    executionCostLines: resolved.result.executionCostLines,
    executionPrincipalInMinor:
      resolved.result.executionPrincipalInMinor.toString(),
    feeTotals: serializeTotals(resolved.result.feeTotals),
    grossAmountOutMinor: resolved.result.grossAmountOutMinor.toString(),
    internalFeeTotals: serializeTotals(resolved.result.internalFeeTotals),
    legs: resolved.result.legs,
    lockedSide: input.draft.lockedSide,
    netAmountOutMinor: resolved.result.netAmountOutMinor.toString(),
    separateExecutionCostMinor:
      resolved.result.separateExecutionCostMinor.toString(),
  };
}
