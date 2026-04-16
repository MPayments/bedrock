import type { ModuleRuntime } from "@bedrock/shared/core";

import { PaymentRouteTemplateNotFoundError } from "../../../errors";
import type { CrossRate } from "../../../rates/application/ports/rates.repository";
import type { CurrenciesPort } from "../../../shared/application/external-ports";
import { previewPaymentRoute } from "../../domain/preview-payment-route";
import { PaymentRouteTemplateAggregate } from "../../domain/payment-route-template";
import {
  UpdatePaymentRouteTemplateInputSchema,
  type UpdatePaymentRouteTemplateInput,
} from "../contracts/commands";
import {
  mapPaymentRouteTemplateRecord,
  type PaymentRouteTemplatesRepository,
} from "../ports/payment-routes.repository";

export class UpdatePaymentRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: CurrenciesPort,
    private readonly repository: PaymentRouteTemplatesRepository,
    private readonly getCrossRate: (
      base: string,
      quote: string,
      asOf: Date,
      anchor?: string,
    ) => Promise<CrossRate>,
  ) {}

  async execute(id: string, input: UpdatePaymentRouteTemplateInput) {
    const validated = UpdatePaymentRouteTemplateInputSchema.parse(input);
    const existing = await this.repository.findTemplateById(id);

    if (!existing) {
      throw new PaymentRouteTemplateNotFoundError(id);
    }

    const aggregate = PaymentRouteTemplateAggregate.fromSnapshot(existing);
    const draft = validated.draft ?? existing.draft;
    const now = this.runtime.now();
    const lastCalculation =
      validated.draft !== undefined
        ? await previewPaymentRoute({
            asOf: now,
            currencies: this.currencies,
            draft,
            getCrossRate: this.getCrossRate,
          })
        : existing.lastCalculation;
    const updated = aggregate.update({
      draft: validated.draft,
      lastCalculation,
      name: validated.name,
      updatedAt: now,
      visual: validated.visual,
    });

    return mapPaymentRouteTemplateRecord(
      (await this.repository.updateTemplate(id, updated.toSnapshot()))!,
    );
  }
}
