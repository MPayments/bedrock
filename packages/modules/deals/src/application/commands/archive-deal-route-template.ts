import { z } from "zod";

import {
  DealRouteTemplateNotFoundError,
  DealRouteTemplateStateError,
} from "../../errors";
import type { DealRouteTemplate } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

const ArchiveDealRouteTemplateInputSchema = z.object({
  templateId: z.uuid(),
});

type ArchiveDealRouteTemplateInput = z.infer<
  typeof ArchiveDealRouteTemplateInputSchema
>;

export class ArchiveDealRouteTemplateCommand {
  constructor(private readonly commandUow: DealsCommandUnitOfWork) {}

  async execute(
    raw: ArchiveDealRouteTemplateInput,
  ): Promise<DealRouteTemplate> {
    const validated = ArchiveDealRouteTemplateInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const current = await tx.dealReads.findRouteTemplateById(validated.templateId);

      if (!current) {
        throw new DealRouteTemplateNotFoundError(validated.templateId);
      }

      if (current.status === "archived") {
        throw new DealRouteTemplateStateError(
          validated.templateId,
          current.status,
          "be archived again",
        );
      }

      await tx.dealStore.setDealRouteTemplate({
        status: "archived",
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
