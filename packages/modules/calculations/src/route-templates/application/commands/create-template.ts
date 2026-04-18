import type { ModuleRuntime } from "@bedrock/shared/core";

import { PaymentRouteTemplateAggregate } from "../../domain/payment-route-template";
import { previewPaymentRoute } from "../../domain/preview-payment-route";
import {
  CreatePaymentRouteTemplateInputSchema,
  type CreatePaymentRouteTemplateInput,
} from "../contracts/commands";
import type {
  RouteTemplateCrossRateLookup,
  RouteTemplateCurrenciesPort,
} from "../ports/external-ports";
import {
  mapPaymentRouteTemplateRecord,
  type PaymentRouteTemplatesRepository,
} from "../ports/payment-routes.repository";

export class CreatePaymentRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly currencies: RouteTemplateCurrenciesPort,
    private readonly repository: PaymentRouteTemplatesRepository,
    private readonly getCrossRate: RouteTemplateCrossRateLookup,
  ) {}

  async execute(input: CreatePaymentRouteTemplateInput) {
    const validated = CreatePaymentRouteTemplateInputSchema.parse(input);
    const now = this.runtime.now();
    const calculation = await previewPaymentRoute({
      asOf: now,
      currencies: this.currencies,
      draft: validated.draft,
      getCrossRate: this.getCrossRate,
    });
    const template = PaymentRouteTemplateAggregate.create({
      createdAt: now,
      draft: validated.draft,
      id: this.runtime.generateUuid(),
      lastCalculation: calculation,
      name: validated.name,
      updatedAt: now,
      visual: validated.visual,
    });

    return mapPaymentRouteTemplateRecord(
      await this.repository.insertTemplate(template.toSnapshot()),
    );
  }
}
