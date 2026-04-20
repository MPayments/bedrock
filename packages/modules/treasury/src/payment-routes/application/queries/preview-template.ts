import type { CrossRate } from "../../../rates/application/ports/rates.repository";
import type { CurrenciesPort } from "../../../shared/application/external-ports";
import { previewPaymentRoute } from "../../domain/preview-payment-route";
import {
  PreviewPaymentRouteInputSchema,
  type PreviewPaymentRouteInput,
} from "../contracts/queries";

export class PreviewPaymentRouteQuery {
  constructor(
    private readonly currencies: CurrenciesPort,
    private readonly getCrossRate: (
      base: string,
      quote: string,
      asOf: Date,
      anchor?: string,
    ) => Promise<CrossRate>,
  ) {}

  async execute(input: PreviewPaymentRouteInput) {
    const validated = PreviewPaymentRouteInputSchema.parse(input);

    return previewPaymentRoute({
      asOf: validated.asOf,
      currencies: this.currencies,
      draft: validated.draft,
      getCrossRate: this.getCrossRate,
    });
  }
}
