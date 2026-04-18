import { previewPaymentRoute } from "../../domain/preview-payment-route";
import {
  PreviewPaymentRouteInputSchema,
  type PreviewPaymentRouteInput,
} from "../contracts/queries";
import type {
  RouteTemplateCrossRateLookup,
  RouteTemplateCurrenciesPort,
} from "../ports/external-ports";

export class PreviewPaymentRouteQuery {
  constructor(
    private readonly currencies: RouteTemplateCurrenciesPort,
    private readonly getCrossRate: RouteTemplateCrossRateLookup,
  ) {}

  async execute(input: PreviewPaymentRouteInput) {
    const validated = PreviewPaymentRouteInputSchema.parse(input);

    return previewPaymentRoute({
      currencies: this.currencies,
      draft: validated.draft,
      getCrossRate: this.getCrossRate,
    });
  }
}
