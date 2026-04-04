import type { CrossRate } from "../../../rates/application/ports";
import type { QuoteFeesPort } from "../../../shared/application/external-ports";
import { QuotePricingPlan } from "../../domain/quote-pricing-plan";
import { QuoteRoute } from "../../domain/quote-route";
import {
  PreviewQuoteInputSchema,
  type PreviewQuoteInput,
} from "../contracts/queries";

export class PreviewQuoteQuery {
  constructor(
    private readonly fees: QuoteFeesPort,
    private readonly getCrossRate: (
      base: string,
      quote: string,
      asOf: Date,
      anchor?: string,
    ) => Promise<CrossRate>,
  ) {}

  async execute(input: PreviewQuoteInput) {
    const validated = PreviewQuoteInputSchema.parse(input);
    const asOf = validated.asOf;

    if (validated.mode === "auto_cross") {
      const cross = await this.getCrossRate(
        validated.fromCurrency,
        validated.toCurrency,
        asOf,
        validated.anchor ?? "USD",
      );
      const sourceAmountMinor = this.resolveAutoCrossSourceAmountMinor({
        input: validated,
        rateNum: cross.rateNum,
        rateDen: cross.rateDen,
      });
      const feeComponents = await this.fees.calculateQuoteFeeComponents({
        fromCurrency: validated.fromCurrency,
        toCurrency: validated.toCurrency,
        principalMinor: sourceAmountMinor,
        dealDirection: validated.dealDirection,
        dealForm: validated.dealForm,
        at: asOf,
      });

      return QuotePricingPlan.autoCross({
        ...validated,
        fromAmountMinor: sourceAmountMinor,
        crossRate: {
          rateNum: cross.rateNum,
          rateDen: cross.rateDen,
        },
        anchor: validated.anchor ?? "USD",
        feeComponents,
      }).toSnapshot();
    }

    const sourceAmountMinor = this.resolveExplicitRouteSourceAmountMinor(
      validated,
    );
    const feeComponents = await this.fees.calculateQuoteFeeComponents({
      fromCurrency: validated.fromCurrency,
      toCurrency: validated.toCurrency,
      principalMinor: sourceAmountMinor,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      at: asOf,
    });

    return QuotePricingPlan.explicitRoute({
      ...validated,
      fromAmountMinor: sourceAmountMinor,
      feeComponents,
    }).toSnapshot();
  }

  private resolveAutoCrossSourceAmountMinor(input: {
    input: Extract<PreviewQuoteInput, { mode: "auto_cross" }>;
    rateNum: bigint;
    rateDen: bigint;
  }): bigint {
    if ("fromAmountMinor" in input.input) {
      return input.input.fromAmountMinor;
    }

    return QuoteRoute.singleFromTarget({
      fromCurrency: input.input.fromCurrency,
      toCurrency: input.input.toCurrency,
      toAmountMinor: input.input.toAmountMinor,
      rateNum: input.rateNum,
      rateDen: input.rateDen,
      asOf: input.input.asOf,
      sourceKind: "derived",
      sourceRef: input.input.anchor ?? "USD",
      executionCounterpartyId: null,
    }).fromAmountMinor;
  }

  private resolveExplicitRouteSourceAmountMinor(
    input: Extract<PreviewQuoteInput, { mode: "explicit_route" }>,
  ): bigint {
    if ("fromAmountMinor" in input) {
      return input.fromAmountMinor;
    }

    return QuoteRoute.explicitFromTarget({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      toAmountMinor: input.toAmountMinor,
      asOf: input.asOf,
      legs: input.legs,
    }).fromAmountMinor;
  }
}
