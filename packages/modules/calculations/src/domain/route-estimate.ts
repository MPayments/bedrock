import { ValidationError } from "@bedrock/shared/core/errors";
import {
  BPS_SCALE,
  effectiveRateFromAmounts,
  mulDivRoundHalfUp,
  parseDecimalToFraction,
} from "@bedrock/shared/money";

import type { CreateCalculationInput } from "../application/contracts/commands";
import type { CalculationLineKind, CalculationRateSource } from "./constants";

type RouteEstimateDealInput = {
  dealId: string;
  sourceAmountMinor: bigint;
  sourceCurrencyId: string;
};

type RouteEstimateLegInput = {
  code: string;
  expectedFromAmountMinor: string | null;
  expectedRateDen: string | null;
  expectedRateNum: string | null;
  expectedToAmountMinor: string | null;
  fromCurrencyId: string;
  id: string;
  idx: number;
  kind: string;
  toCurrencyId: string;
};

type RouteEstimateComponentInput = {
  basisType:
    | "deal_source_amount"
    | "deal_target_amount"
    | "gross_revenue"
    | "leg_from_amount"
    | "leg_to_amount";
  bps: string | null;
  classification: "adjustment" | "expense" | "pass_through" | "revenue";
  code: string;
  currencyId: string;
  family: string;
  fixedAmountMinor: string | null;
  formulaType: "bps" | "fixed" | "manual" | "per_million";
  id: string;
  includedInClientRate: boolean;
  legCode: string | null;
  manualAmountMinor: string | null;
  perMillion: string | null;
  sequence: number;
};

type RouteEstimateAgreementPolicyInput = {
  agreementVersionId: string | null;
  defaultMarkupBps: string | null;
  defaultSubAgentCommissionAmountMinor: string | null;
  defaultSubAgentCommissionBps: string | null;
  defaultSubAgentCommissionCurrencyId: string | null;
  defaultSubAgentCommissionUnit: "bps" | "money" | null;
  defaultWireFeeAmountMinor: string | null;
  defaultWireFeeCurrencyId: string | null;
};

type RouteEstimatePricingInput = {
  baseCurrencyId: string | null;
  calculationTimestamp: Date;
  fxQuoteId: string | null;
  quoteSnapshot: Record<string, unknown> | null;
  rateDen: bigint | null;
  rateNum: bigint | null;
  rateSource: CalculationRateSource;
  totalInBaseMinor: bigint | null;
};

export type BuildRouteEstimateCalculationInput = {
  agreementPolicy: RouteEstimateAgreementPolicyInput | null;
  deal: RouteEstimateDealInput;
  dealSnapshot: Record<string, unknown> | null;
  pricing: RouteEstimatePricingInput;
  route: {
    costComponents: RouteEstimateComponentInput[];
    legs: RouteEstimateLegInput[];
    routeVersionId: string;
    routeSnapshot: Record<string, unknown> | null;
  };
};

type ResolvedComponent = RouteEstimateComponentInput & {
  currencyId: string;
  sourceKind: "agreement" | "system";
};

function parseNullableMinor(value: string | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function parseDecimalFactor(value: string, field: string) {
  try {
    return parseDecimalToFraction(value, { allowScientific: false });
  } catch {
    throw new ValidationError(`${field} must be a positive decimal string`);
  }
}

function calcFormulaAmount(input: {
  basisAmountMinor: bigint;
  component: ResolvedComponent;
}) {
  switch (input.component.formulaType) {
    case "fixed": {
      const fixedAmountMinor = parseNullableMinor(input.component.fixedAmountMinor);
      if (fixedAmountMinor === null) {
        throw new ValidationError(
          `Route component ${input.component.code} requires fixedAmountMinor`,
        );
      }

      return fixedAmountMinor;
    }
    case "manual": {
      const manualAmountMinor = parseNullableMinor(
        input.component.manualAmountMinor,
      );
      if (manualAmountMinor === null) {
        throw new ValidationError(
          `Route component ${input.component.code} requires manualAmountMinor`,
        );
      }

      return manualAmountMinor;
    }
    case "bps": {
      if (!input.component.bps) {
        throw new ValidationError(
          `Route component ${input.component.code} requires bps`,
        );
      }

      const fraction = parseDecimalFactor(
        input.component.bps,
        `${input.component.code}.bps`,
      );
      return mulDivRoundHalfUp(
        input.basisAmountMinor,
        fraction.num,
        fraction.den * BPS_SCALE,
      );
    }
    case "per_million": {
      if (!input.component.perMillion) {
        throw new ValidationError(
          `Route component ${input.component.code} requires perMillion`,
        );
      }

      const fraction = parseDecimalFactor(
        input.component.perMillion,
        `${input.component.code}.perMillion`,
      );
      return mulDivRoundHalfUp(
        input.basisAmountMinor,
        fraction.num,
        fraction.den * 1_000_000n,
      );
    }
  }
}

function mapRevenueLineKind(input: {
  component: RouteEstimateComponentInput;
}) {
  if (input.component.includedInClientRate) {
    return "spread_revenue" as const;
  }

  return "fee_revenue" as const;
}

function mapLineKind(input: {
  component: RouteEstimateComponentInput;
}): CalculationLineKind {
  switch (input.component.classification) {
    case "revenue":
      return mapRevenueLineKind(input);
    case "expense":
      return "provider_fee_expense";
    case "pass_through":
      return "pass_through";
    case "adjustment":
      return "adjustment";
  }
}

function overrideComponentFromAgreement(input: {
  component: RouteEstimateComponentInput;
  policy: RouteEstimateAgreementPolicyInput | null;
}): ResolvedComponent {
  const policy = input.policy;

  if (!policy) {
    return {
      ...input.component,
      currencyId: input.component.currencyId,
      sourceKind: "system",
    };
  }

  if (input.component.code === "client_markup" && policy.defaultMarkupBps) {
    return {
      ...input.component,
      bps: policy.defaultMarkupBps,
      currencyId: input.component.currencyId,
      fixedAmountMinor: null,
      formulaType: "bps",
      manualAmountMinor: null,
      perMillion: null,
      sourceKind: "agreement",
    };
  }

  if (
    input.component.code === "wire_fee" &&
    policy.defaultWireFeeAmountMinor &&
    policy.defaultWireFeeCurrencyId
  ) {
    return {
      ...input.component,
      bps: null,
      currencyId: policy.defaultWireFeeCurrencyId,
      fixedAmountMinor: policy.defaultWireFeeAmountMinor,
      formulaType: "fixed",
      manualAmountMinor: null,
      perMillion: null,
      sourceKind: "agreement",
    };
  }

  if (
    input.component.code === "subagent_commission" &&
    policy.defaultSubAgentCommissionUnit
  ) {
    if (
      policy.defaultSubAgentCommissionUnit === "bps" &&
      policy.defaultSubAgentCommissionBps
    ) {
      return {
        ...input.component,
        bps: policy.defaultSubAgentCommissionBps,
        currencyId:
          policy.defaultSubAgentCommissionCurrencyId ?? input.component.currencyId,
        fixedAmountMinor: null,
        formulaType: "bps",
        manualAmountMinor: null,
        perMillion: null,
        sourceKind: "agreement",
      };
    }

    if (
      policy.defaultSubAgentCommissionUnit === "money" &&
      policy.defaultSubAgentCommissionAmountMinor &&
      policy.defaultSubAgentCommissionCurrencyId
    ) {
      return {
        ...input.component,
        bps: null,
        currencyId: policy.defaultSubAgentCommissionCurrencyId,
        fixedAmountMinor: policy.defaultSubAgentCommissionAmountMinor,
        formulaType: "fixed",
        manualAmountMinor: null,
        perMillion: null,
        sourceKind: "agreement",
      };
    }
  }

  return {
    ...input.component,
    currencyId: input.component.currencyId,
    sourceKind: "system",
  };
}

function resolvePricing(input: BuildRouteEstimateCalculationInput) {
  const sortedLegs = [...input.route.legs].sort((left, right) => left.idx - right.idx);
  const lastLeg = sortedLegs.at(-1) ?? null;
  const baseCurrencyId =
    input.pricing.baseCurrencyId ?? lastLeg?.toCurrencyId ?? null;

  if (!baseCurrencyId) {
    throw new ValidationError("Route pricing requires a base currency");
  }

  let totalInBaseMinor = input.pricing.totalInBaseMinor;

  if (totalInBaseMinor === null) {
    if (lastLeg?.expectedToAmountMinor && lastLeg.toCurrencyId === baseCurrencyId) {
      totalInBaseMinor = BigInt(lastLeg.expectedToAmountMinor);
    } else if (input.deal.sourceCurrencyId === baseCurrencyId) {
      totalInBaseMinor = input.deal.sourceAmountMinor;
    }
  }

  let rateNum = input.pricing.rateNum;
  let rateDen = input.pricing.rateDen;

  if (totalInBaseMinor === null && rateNum !== null && rateDen !== null) {
    totalInBaseMinor = mulDivRoundHalfUp(
      input.deal.sourceAmountMinor,
      rateNum,
      rateDen,
    );
  }

  if (totalInBaseMinor === null) {
    throw new ValidationError(
      "Route estimate pricing requires totalInBaseMinor or an inferable target amount",
    );
  }

  if (rateNum === null || rateDen === null) {
    const effectiveRate = effectiveRateFromAmounts(
      input.deal.sourceAmountMinor,
      totalInBaseMinor,
    );
    rateNum = effectiveRate.rateNum;
    rateDen = effectiveRate.rateDen;
  }

  return {
    baseCurrencyId,
    rateDen,
    rateNum,
    totalInBaseMinor,
  };
}

function deriveLegAmountMaps(input: {
  baseCurrencyId: string;
  deal: RouteEstimateDealInput;
  legs: RouteEstimateLegInput[];
  totalInBaseMinor: bigint;
}) {
  const sortedLegs = [...input.legs].sort((left, right) => left.idx - right.idx);
  const fromAmountByCode = new Map<string, bigint>();
  const toAmountByCode = new Map<string, bigint>();

  for (const leg of sortedLegs) {
    if (leg.expectedFromAmountMinor) {
      fromAmountByCode.set(leg.code, BigInt(leg.expectedFromAmountMinor));
    }

    if (leg.expectedToAmountMinor) {
      toAmountByCode.set(leg.code, BigInt(leg.expectedToAmountMinor));
    }
  }

  for (let iteration = 0; iteration < sortedLegs.length + 1; iteration += 1) {
    let changed = false;

    for (const [index, leg] of sortedLegs.entries()) {
      const previous = index > 0 ? sortedLegs[index - 1] ?? null : null;
      const next =
        index < sortedLegs.length - 1 ? sortedLegs[index + 1] ?? null : null;

      if (!fromAmountByCode.has(leg.code)) {
        let candidate: bigint | null = null;

        if (index === 0 && leg.fromCurrencyId === input.deal.sourceCurrencyId) {
          candidate = input.deal.sourceAmountMinor;
        } else if (
          previous &&
          previous.toCurrencyId === leg.fromCurrencyId &&
          toAmountByCode.has(previous.code)
        ) {
          candidate = toAmountByCode.get(previous.code)!;
        } else if (
          leg.toCurrencyId === leg.fromCurrencyId &&
          toAmountByCode.has(leg.code)
        ) {
          candidate = toAmountByCode.get(leg.code)!;
        }

        if (candidate !== null) {
          fromAmountByCode.set(leg.code, candidate);
          changed = true;
        }
      }

      if (!toAmountByCode.has(leg.code)) {
        let candidate: bigint | null = null;
        const fromAmount = fromAmountByCode.get(leg.code) ?? null;

        if (leg.toCurrencyId === leg.fromCurrencyId && fromAmount !== null) {
          candidate = fromAmount;
        } else if (
          fromAmount !== null &&
          leg.expectedRateNum &&
          leg.expectedRateDen
        ) {
          candidate = mulDivRoundHalfUp(
            fromAmount,
            BigInt(leg.expectedRateNum),
            BigInt(leg.expectedRateDen),
          );
        } else if (
          next &&
          next.fromCurrencyId === leg.toCurrencyId &&
          fromAmountByCode.has(next.code)
        ) {
          candidate = fromAmountByCode.get(next.code)!;
        } else if (
          index === sortedLegs.length - 1 &&
          leg.toCurrencyId === input.baseCurrencyId
        ) {
          candidate = input.totalInBaseMinor;
        }

        if (candidate !== null) {
          toAmountByCode.set(leg.code, candidate);
          changed = true;
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  return {
    fromAmountByCode,
    toAmountByCode,
  };
}

function resolveComponentBasisMinor(input: {
  component: ResolvedComponent;
  deal: RouteEstimateDealInput;
  fromAmountByCode: Map<string, bigint>;
  grossRevenueByCurrency: Map<string, bigint>;
  legsByCode: Map<string, RouteEstimateLegInput>;
  targetCurrencyId: string;
  toAmountByCode: Map<string, bigint>;
  targetAmountMinor: bigint;
}) {
  switch (input.component.basisType) {
    case "deal_source_amount":
      if (input.component.currencyId !== input.deal.sourceCurrencyId) {
        throw new ValidationError(
          `Route component ${input.component.code} expects source currency basis`,
        );
      }
      return input.deal.sourceAmountMinor;
    case "deal_target_amount":
      if (input.component.currencyId !== input.targetCurrencyId) {
        throw new ValidationError(
          `Route component ${input.component.code} currency must match target amount currency`,
        );
      }
      return input.targetAmountMinor;
    case "gross_revenue":
      return input.grossRevenueByCurrency.get(input.component.currencyId) ?? 0n;
    case "leg_from_amount": {
      const legCode = input.component.legCode;
      if (!legCode) {
        throw new ValidationError(
          `Route component ${input.component.code} requires legCode`,
        );
      }

      const leg = input.legsByCode.get(legCode);
      const amountMinor = input.fromAmountByCode.get(legCode) ?? null;

      if (!leg || amountMinor === null) {
        throw new ValidationError(
          `Route component ${input.component.code} is missing leg from amount`,
        );
      }

      if (leg.fromCurrencyId !== input.component.currencyId) {
        throw new ValidationError(
          `Route component ${input.component.code} currency must match leg from currency`,
        );
      }

      return amountMinor;
    }
    case "leg_to_amount": {
      const legCode = input.component.legCode;
      if (!legCode) {
        throw new ValidationError(
          `Route component ${input.component.code} requires legCode`,
        );
      }

      const leg = input.legsByCode.get(legCode);
      const amountMinor = input.toAmountByCode.get(legCode) ?? null;

      if (!leg || amountMinor === null) {
        throw new ValidationError(
          `Route component ${input.component.code} is missing leg to amount`,
        );
      }

      if (leg.toCurrencyId !== input.component.currencyId) {
        throw new ValidationError(
          `Route component ${input.component.code} currency must match leg to currency`,
        );
      }

      return amountMinor;
    }
  }
}

function toSourceMinor(input: {
  amountMinor: bigint;
  baseCurrencyId: string;
  calculationCurrencyId: string;
  currencyId: string;
  rateDen: bigint;
  rateNum: bigint;
}) {
  if (input.currencyId === input.calculationCurrencyId) {
    return input.amountMinor;
  }

  if (input.currencyId === input.baseCurrencyId) {
    return mulDivRoundHalfUp(input.amountMinor, input.rateDen, input.rateNum);
  }

  throw new ValidationError(
    `Route component currency ${input.currencyId} is unsupported for source conversion`,
  );
}

function toBaseMinor(input: {
  amountMinor: bigint;
  baseCurrencyId: string;
  calculationCurrencyId: string;
  currencyId: string;
  rateDen: bigint;
  rateNum: bigint;
}) {
  if (input.currencyId === input.baseCurrencyId) {
    return input.amountMinor;
  }

  if (input.currencyId === input.calculationCurrencyId) {
    return mulDivRoundHalfUp(input.amountMinor, input.rateNum, input.rateDen);
  }

  throw new ValidationError(
    `Route component currency ${input.currencyId} is unsupported for base conversion`,
  );
}

function ratioToRoundedBps(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) {
    return 0n;
  }

  return mulDivRoundHalfUp(numerator, BPS_SCALE, denominator);
}

export function buildRouteEstimateCalculationInput(
  input: BuildRouteEstimateCalculationInput,
): CreateCalculationInput {
  const pricing = resolvePricing(input);
  const sortedComponents = [...input.route.costComponents].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const overriddenComponents = sortedComponents.map((component) =>
    overrideComponentFromAgreement({
      component,
      policy: input.agreementPolicy,
    }),
  );
  const legsByCode = new Map(
    input.route.legs.map((leg) => [leg.code, leg] as const),
  );
  const legAmountMaps = deriveLegAmountMaps({
    baseCurrencyId: pricing.baseCurrencyId,
    deal: input.deal,
    legs: input.route.legs,
    totalInBaseMinor: pricing.totalInBaseMinor,
  });

  const grossRevenueByCurrency = new Map<string, bigint>();
  let grossRevenueInBaseMinor = 0n;
  let expenseAmountInBaseMinor = 0n;
  let passThroughAmountInBaseMinor = 0n;
  let netMarginInBaseMinor = 0n;
  let totalFeeAmountMinor = 0n;
  let totalFeeAmountInBaseMinor = 0n;
  let quoteMarkupBps = 0n;
  let quoteMarkupAmountMinor = 0n;
  const financialLines: NonNullable<CreateCalculationInput["financialLines"]> = [];

  for (const component of overriddenComponents) {
    const basisAmountMinor = resolveComponentBasisMinor({
      component,
      deal: input.deal,
      fromAmountByCode: legAmountMaps.fromAmountByCode,
      grossRevenueByCurrency,
      legsByCode,
      targetCurrencyId: pricing.baseCurrencyId,
      toAmountByCode: legAmountMaps.toAmountByCode,
      targetAmountMinor: pricing.totalInBaseMinor,
    });
    const amountMinor = calcFormulaAmount({
      basisAmountMinor,
      component,
    });
    const amountInBaseMinor = toBaseMinor({
      amountMinor,
      baseCurrencyId: pricing.baseCurrencyId,
      calculationCurrencyId: input.deal.sourceCurrencyId,
      currencyId: component.currencyId,
      rateDen: pricing.rateDen,
      rateNum: pricing.rateNum,
    });
    const amountInSourceMinor = toSourceMinor({
      amountMinor,
      baseCurrencyId: pricing.baseCurrencyId,
      calculationCurrencyId: input.deal.sourceCurrencyId,
      currencyId: component.currencyId,
      rateDen: pricing.rateDen,
      rateNum: pricing.rateNum,
    });

    if (component.classification === "revenue") {
      grossRevenueByCurrency.set(
        component.currencyId,
        (grossRevenueByCurrency.get(component.currencyId) ?? 0n) + amountMinor,
      );
      grossRevenueInBaseMinor += amountInBaseMinor;
      netMarginInBaseMinor += amountInBaseMinor;
      totalFeeAmountMinor += amountInSourceMinor;
      totalFeeAmountInBaseMinor += amountInBaseMinor;

      if (component.code === "client_markup") {
        quoteMarkupAmountMinor += amountInSourceMinor;
        if (component.formulaType === "bps" && component.bps) {
          const fraction = parseDecimalFactor(
            component.bps,
            `${component.code}.bps`,
          );
          quoteMarkupBps = mulDivRoundHalfUp(fraction.num, 1n, fraction.den);
        }
      }
    } else if (component.classification === "expense") {
      expenseAmountInBaseMinor += amountInBaseMinor;
      netMarginInBaseMinor -= amountInBaseMinor;
    } else if (component.classification === "pass_through") {
      passThroughAmountInBaseMinor += amountInBaseMinor;
    } else {
      netMarginInBaseMinor += amountInBaseMinor;
    }

    financialLines.push({
      amountMinor: amountMinor.toString(),
      basisAmountMinor: basisAmountMinor.toString(),
      basisType: component.basisType,
      classification: component.classification,
      componentCode: component.code,
      componentFamily: component.family,
      currencyId: component.currencyId,
      dealId: input.deal.dealId,
      formulaType: component.formulaType,
      inputBps: component.bps,
      inputFixedAmountMinor: component.fixedAmountMinor,
      inputManualAmountMinor: component.manualAmountMinor,
      inputPerMillion: component.perMillion,
      kind: mapLineKind({ component }),
      routeComponentId: component.id,
      routeLegId: component.legCode
        ? (legsByCode.get(component.legCode)?.id ?? null)
        : null,
      routeVersionId: input.route.routeVersionId,
      sourceKind: component.sourceKind,
    });
  }

  const originalAmountMinor = input.deal.sourceAmountMinor;
  const totalAmountMinor = originalAmountMinor + totalFeeAmountMinor;
  const totalWithExpensesInBaseMinor =
    pricing.totalInBaseMinor + totalFeeAmountInBaseMinor + passThroughAmountInBaseMinor;
  const nonZeroPassThroughLines = financialLines.filter(
    (line) => line.classification === "pass_through" && line.amountMinor !== "0",
  );
  const passThroughCurrencies = Array.from(
    new Set(nonZeroPassThroughLines.map((line) => line.currencyId)),
  );

  if (passThroughCurrencies.length > 1) {
    throw new ValidationError(
      "Route estimate supports pass-through totals in a single currency only",
    );
  }

  const additionalExpensesCurrencyId = passThroughCurrencies[0] ?? null;
  const additionalExpensesAmountMinor =
    additionalExpensesCurrencyId === null
      ? 0n
      : nonZeroPassThroughLines.reduce((total, line) => {
          if (line.currencyId !== additionalExpensesCurrencyId) {
            return total;
          }

          return total + BigInt(line.amountMinor);
        }, 0n);

  const additionalExpensesRateRequired =
    additionalExpensesCurrencyId !== null &&
    additionalExpensesCurrencyId !== pricing.baseCurrencyId;

  return {
    agreementFeeAmountMinor: "0",
    agreementFeeBps: "0",
    agreementVersionId: input.agreementPolicy?.agreementVersionId ?? null,
    additionalExpensesAmountMinor: additionalExpensesAmountMinor.toString(),
    additionalExpensesCurrencyId,
    additionalExpensesInBaseMinor: passThroughAmountInBaseMinor.toString(),
    additionalExpensesRateDen: additionalExpensesRateRequired
      ? pricing.rateDen.toString()
      : null,
    additionalExpensesRateNum: additionalExpensesRateRequired
      ? pricing.rateNum.toString()
      : null,
    additionalExpensesRateSource: additionalExpensesRateRequired
      ? input.pricing.rateSource
      : null,
    baseCurrencyId: pricing.baseCurrencyId,
    calculationCurrencyId: input.deal.sourceCurrencyId,
    calculationTimestamp: input.pricing.calculationTimestamp,
    dealId: input.deal.dealId,
    dealSnapshot: input.dealSnapshot,
    expenseAmountInBaseMinor: expenseAmountInBaseMinor.toString(),
    financialLines,
    fixedFeeAmountMinor: "0",
    fixedFeeCurrencyId: null,
    fxQuoteId: input.pricing.fxQuoteId,
    grossRevenueInBaseMinor: grossRevenueInBaseMinor.toString(),
    netMarginInBaseMinor: netMarginInBaseMinor.toString(),
    originalAmountMinor: originalAmountMinor.toString(),
    passThroughAmountInBaseMinor: passThroughAmountInBaseMinor.toString(),
    pricingProvenance: {
      agreementVersionId: input.agreementPolicy?.agreementVersionId ?? null,
      resolvedPricing: {
        baseCurrencyId: pricing.baseCurrencyId,
        totalInBaseMinor: pricing.totalInBaseMinor.toString(),
      },
      source: "route_estimate",
    },
    quoteMarkupAmountMinor: quoteMarkupAmountMinor.toString(),
    quoteMarkupBps: quoteMarkupBps.toString(),
    quoteSnapshot: input.pricing.quoteSnapshot,
    rateDen: pricing.rateDen.toString(),
    rateNum: pricing.rateNum.toString(),
    rateSource: input.pricing.rateSource,
    referenceRateAsOf: null,
    referenceRateDen: null,
    referenceRateNum: null,
    referenceRateSource: null,
    routeSnapshot: input.route.routeSnapshot,
    routeVersionId: input.route.routeVersionId,
    state: "draft",
    totalAmountMinor: totalAmountMinor.toString(),
    totalFeeAmountInBaseMinor: totalFeeAmountInBaseMinor.toString(),
    totalFeeAmountMinor: totalFeeAmountMinor.toString(),
    totalFeeBps: ratioToRoundedBps(
      totalFeeAmountMinor,
      originalAmountMinor,
    ).toString(),
    totalInBaseMinor: pricing.totalInBaseMinor.toString(),
    totalWithExpensesInBaseMinor: totalWithExpensesInBaseMinor.toString(),
  };
}
