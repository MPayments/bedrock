import type { CrossRate } from "../../../rates/application/ports";
import type { QuoteFeesPort } from "../../../shared/application/external-ports";
import { QuotePricingPlan } from "../../domain/quote-pricing-plan";
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
    const feeComponents = await this.fees.calculateQuoteFeeComponents({
      fromCurrency: validated.fromCurrency,
      toCurrency: validated.toCurrency,
      principalMinor: validated.fromAmountMinor,
      dealDirection: validated.dealDirection,
      dealForm: validated.dealForm,
      at: asOf,
    });

    if (validated.mode === "auto_cross") {
      const cross = await this.getCrossRate(
        validated.fromCurrency,
        validated.toCurrency,
        asOf,
        validated.anchor ?? "USD",
      );

      return QuotePricingPlan.autoCross({
        ...validated,
        crossRate: {
          rateNum: cross.rateNum,
          rateDen: cross.rateDen,
        },
        anchor: validated.anchor ?? "USD",
        feeComponents,
      }).toSnapshot();
    }

    return QuotePricingPlan.explicitRoute({
      ...validated,
      feeComponents,
    }).toSnapshot();
  }
}
