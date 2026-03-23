import {
  type FinancialLine,
} from "@bedrock/documents/contracts";
import { stableStringify } from "@bedrock/shared/core/canon";
import { invariant } from "@bedrock/shared/core/domain";
import { effectiveRateFromAmounts } from "@bedrock/shared/money/math";

import {
  financialLinesFromFeeComponents,
  normalizeFinancialLines,
} from "./fee-financial-lines";
import type { QuoteLegSnapshot } from "./quote-leg";
import { QuoteRoute } from "./quote-route";
import type { QuotePricingMode } from "./quote-types";
import type { FeeComponent } from "../../fees/domain/fee-types";

const DEFAULT_QUOTE_TTL_SECONDS = 600;

export interface QuotePricingPlanSnapshot {
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: QuotePricingMode;
  pricingTrace: Record<string, unknown>;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  expiresAt: Date;
  legs: QuoteLegSnapshot[];
  feeComponents: FeeComponent[];
  financialLines: FinancialLine[];
}

interface QuotePricingPlanBaseInput {
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  dealDirection?: string;
  dealForm?: string;
  ttlSeconds?: number;
  asOf: Date;
  manualFinancialLines?: FinancialLine[];
  feeComponents: FeeComponent[];
}

export class QuotePricingPlan {
  private constructor(private readonly snapshot: QuotePricingPlanSnapshot) {}

  static autoCross(
    input: QuotePricingPlanBaseInput & {
      anchor?: string;
      pricingTrace?: Record<string, unknown>;
      crossRate: {
        rateNum: bigint;
        rateDen: bigint;
      };
    },
  ): QuotePricingPlan {
    const route = QuoteRoute.single({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      fromAmountMinor: input.fromAmountMinor,
      rateNum: input.crossRate.rateNum,
      rateDen: input.crossRate.rateDen,
      asOf: input.asOf,
      sourceKind: "derived",
      sourceRef: input.anchor ?? "USD",
      executionCounterpartyId: null,
    });
    const toAmountMinor = route.toAmountMinor;
    const effectiveRate = effectiveRateFromAmounts(
      input.fromAmountMinor,
      toAmountMinor,
    );

    return new QuotePricingPlan(
      buildPricingPlanSnapshot({
        ...input,
        route,
        pricingMode: "auto_cross",
        pricingTrace:
          input.pricingTrace ??
          buildAutoCrossTrace({
            fromCurrency: input.fromCurrency,
            toCurrency: input.toCurrency,
            asOf: input.asOf,
            anchor: input.anchor ?? "USD",
            rateNum: input.crossRate.rateNum,
            rateDen: input.crossRate.rateDen,
          }),
        rateNum: effectiveRate.rateNum,
        rateDen: effectiveRate.rateDen,
      }),
    );
  }

  static explicitRoute(
    input: QuotePricingPlanBaseInput & {
      pricingTrace: Record<string, unknown>;
      legs: {
        fromCurrency: string;
        toCurrency: string;
        rateNum: bigint;
        rateDen: bigint;
        sourceKind: QuoteLegSnapshot["sourceKind"];
        sourceRef?: string | null;
        asOf?: Date;
        executionCounterpartyId?: string | null;
      }[];
    },
  ): QuotePricingPlan {
    const route = QuoteRoute.explicit({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      fromAmountMinor: input.fromAmountMinor,
      asOf: input.asOf,
      legs: input.legs,
    });
    const effectiveRate = effectiveRateFromAmounts(
      input.fromAmountMinor,
      route.toAmountMinor,
    );

    return new QuotePricingPlan(
      buildPricingPlanSnapshot({
        ...input,
        route,
        pricingMode: "explicit_route",
        pricingTrace: input.pricingTrace,
        rateNum: effectiveRate.rateNum,
        rateDen: effectiveRate.rateDen,
      }),
    );
  }

  toSnapshot(): QuotePricingPlanSnapshot {
    return {
      ...this.snapshot,
      pricingTrace: { ...this.snapshot.pricingTrace },
      legs: this.snapshot.legs.map((leg) => ({ ...leg })),
      feeComponents: this.snapshot.feeComponents.map((component) => ({
        ...component,
        metadata: component.metadata ? { ...component.metadata } : undefined,
      })),
      financialLines: this.snapshot.financialLines.map((line) => ({
        ...line,
        metadata: line.metadata ? { ...line.metadata } : undefined,
      })),
    };
  }

  matchesPersistedChildren(input: {
    legs: QuoteLegSnapshot[];
    feeComponents: FeeComponent[];
    financialLines: FinancialLine[];
  }): boolean {
    return (
      stableStringify(
        this.snapshot.legs.map(serializeQuoteLegSnapshot),
      ) === stableStringify(input.legs.map(serializeQuoteLegSnapshot)) &&
      stableStringify(
        this.snapshot.feeComponents.map(serializeFeeComponent),
      ) === stableStringify(input.feeComponents.map(serializeFeeComponent)) &&
      stableStringify(
        normalizeFinancialLines(this.snapshot.financialLines).map(
          serializeFinancialLine,
        ),
      ) ===
        stableStringify(
          normalizeFinancialLines(input.financialLines).map(
            serializeFinancialLine,
          ),
        )
    );
  }
}

function buildPricingPlanSnapshot(input: QuotePricingPlanBaseInput & {
  route: QuoteRoute;
  pricingMode: QuotePricingMode;
  pricingTrace: Record<string, unknown>;
  rateNum: bigint;
  rateDen: bigint;
}): QuotePricingPlanSnapshot {
  invariant(
    input.fromCurrency.trim().toUpperCase() !==
      input.toCurrency.trim().toUpperCase(),
    "fromCurrency and toCurrency must be different",
    {
      code: "treasury.quote.same_currency",
    },
  );

  const financialLines = normalizeFinancialLines([
    ...financialLinesFromFeeComponents(input.feeComponents),
    ...(input.manualFinancialLines ?? []),
  ]);
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;

  return {
    fromCurrency: input.fromCurrency.trim().toUpperCase(),
    toCurrency: input.toCurrency.trim().toUpperCase(),
    fromAmountMinor: input.fromAmountMinor,
    toAmountMinor: input.route.toAmountMinor,
    pricingMode: input.pricingMode,
    pricingTrace: input.pricingTrace,
    dealDirection: input.dealDirection ?? null,
    dealForm: input.dealForm ?? null,
    rateNum: input.rateNum,
    rateDen: input.rateDen,
    expiresAt: new Date(input.asOf.getTime() + ttlSeconds * 1000),
    legs: input.route.toSnapshots(),
    feeComponents: input.feeComponents.map((component) => ({
      ...component,
      metadata: component.metadata ? { ...component.metadata } : undefined,
    })),
    financialLines,
  };
}

function buildAutoCrossTrace(input: {
  fromCurrency: string;
  toCurrency: string;
  asOf: Date;
  anchor: string;
  rateNum: bigint;
  rateDen: bigint;
}) {
  return {
    version: "v1",
    mode: "auto_cross",
    anchor: input.anchor,
    summary: `${input.fromCurrency}/${input.toCurrency} cross quote`,
    steps: [
      {
        type: "cross_rate",
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rateNum: input.rateNum.toString(),
        rateDen: input.rateDen.toString(),
        asOf: input.asOf.toISOString(),
      },
    ],
  } as Record<string, unknown>;
}

function serializeQuoteLegSnapshot(leg: QuoteLegSnapshot) {
  return {
    ...leg,
    fromAmountMinor: leg.fromAmountMinor.toString(),
    toAmountMinor: leg.toAmountMinor.toString(),
    rateNum: leg.rateNum.toString(),
    rateDen: leg.rateDen.toString(),
    asOf: leg.asOf.toISOString(),
  };
}

function serializeFeeComponent(component: FeeComponent) {
  return {
    ...component,
    amountMinor: component.amountMinor.toString(),
  };
}

function serializeFinancialLine(line: FinancialLine) {
  return {
    ...line,
    amountMinor: line.amountMinor.toString(),
  };
}
