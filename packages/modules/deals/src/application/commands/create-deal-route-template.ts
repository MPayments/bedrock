import type { ModuleRuntime } from "@bedrock/shared/core";

import { validateDealRouteTemplateDefinition } from "../../domain/route-template-validation";
import { DealRouteValidationError } from "../../errors";
import {
  CreateDealRouteTemplateInputSchema,
  type CreateDealRouteTemplateInput,
} from "../contracts/commands";
import type { DealRouteTemplate } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import {
  replaceRouteTemplateBody,
  validateDealRouteTemplateReferences,
} from "../shared/route-template";

export class CreateDealRouteTemplateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    private readonly references: DealReferencesPort,
  ) {}

  async execute(raw: CreateDealRouteTemplateInput): Promise<DealRouteTemplate> {
    const validated = CreateDealRouteTemplateInputSchema.parse(raw);

    await validateDealRouteTemplateReferences({
      references: this.references,
      template: validated,
    });

    const validationIssues = validateDealRouteTemplateDefinition(validated);
    const blockingIssues = validationIssues.filter(
      (issue) => issue.severity === "error",
    );

    if (blockingIssues.length > 0) {
      throw new DealRouteValidationError(validated.code, blockingIssues);
    }

    return this.commandUow.run(async (tx) => {
      const templateId = this.runtime.generateUuid();

      await tx.dealStore.createDealRouteTemplate({
        code: validated.code,
        dealType: validated.dealType,
        description: validated.description,
        id: templateId,
        name: validated.name,
        status: "draft",
      });
      await replaceRouteTemplateBody({
        routeTemplateId: templateId,
        runtime: this.runtime,
        template: validated,
        tx,
      });

      const template = await tx.dealReads.findRouteTemplateById(templateId);
      if (!template) {
        throw new Error(`Route template ${templateId} was not persisted`);
      }

      return template;
    });
  }
}
