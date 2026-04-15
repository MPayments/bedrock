import { z } from "zod";

import {
  DealRouteTemplateNotFoundError,
  DealRouteTemplateStateError,
} from "../../errors";
import type { DealRouteTemplate } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

const PublishDealRouteTemplateInputSchema = z.object({
  templateId: z.uuid(),
});

type PublishDealRouteTemplateInput = z.infer<
  typeof PublishDealRouteTemplateInputSchema
>;

export class PublishDealRouteTemplateCommand {
  constructor(private readonly commandUow: DealsCommandUnitOfWork) {}

  async execute(
    raw: PublishDealRouteTemplateInput,
  ): Promise<DealRouteTemplate> {
    const validated = PublishDealRouteTemplateInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const current = await tx.dealReads.findRouteTemplateById(validated.templateId);

      if (!current) {
        throw new DealRouteTemplateNotFoundError(validated.templateId);
      }

      if (current.status !== "draft") {
        throw new DealRouteTemplateStateError(
          validated.templateId,
          current.status,
          "be published",
        );
      }

      await tx.dealStore.setDealRouteTemplate({
        status: "published",
        templateId: validated.templateId,
      });

      const template = await tx.dealReads.findRouteTemplateById(validated.templateId);
      if (!template) {
        throw new DealRouteTemplateNotFoundError(validated.templateId);
      }

      return template;
    });
  }
}
