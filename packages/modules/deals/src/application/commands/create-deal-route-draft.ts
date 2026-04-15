import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  CreateDealRouteDraftInputSchema,
} from "../contracts/commands";
import type { DealRouteVersion } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

const CreateDealRouteDraftCommandInputSchema = CreateDealRouteDraftInputSchema.extend({
  dealId: z.uuid(),
});

type CreateDealRouteDraftCommandInput = {
  dealId: string;
};

export class CreateDealRouteDraftCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: CreateDealRouteDraftCommandInput,
  ): Promise<DealRouteVersion> {
    const validated = CreateDealRouteDraftCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const deal = await tx.dealReads.findById(validated.dealId);
      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      const currentRoute = await tx.dealReads.findCurrentRouteByDealId(
        validated.dealId,
      );
      if (currentRoute) {
        return currentRoute;
      }

      const now = this.runtime.now();
      const routeId = this.runtime.generateUuid();
      const versionId = this.runtime.generateUuid();

      await tx.dealStore.createDealRoute({
        dealId: validated.dealId,
        id: routeId,
      });
      await tx.dealStore.createDealRouteVersion({
        dealId: validated.dealId,
        id: versionId,
        routeId,
        validationIssues: [],
        version: 1,
      });
      await tx.dealStore.setDealRouteCurrentVersion({
        currentVersionId: versionId,
        dealId: validated.dealId,
      });

      const created = await tx.dealReads.findCurrentRouteByDealId(validated.dealId);
      if (!created) {
        throw new DealNotFoundError(validated.dealId);
      }

      return {
        ...created,
        createdAt: now,
      };
    });
  }
}
