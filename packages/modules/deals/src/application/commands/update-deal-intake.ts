import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  UpdateDealIntakeInputSchema,
  type UpdateDealIntakeInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import { applyLegacyIntakePatch } from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import { ReplaceDealIntakeCommand } from "./replace-deal-intake";

const UpdateDealIntakeCommandInputSchema = UpdateDealIntakeInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
});

type UpdateDealIntakeCommandInput = UpdateDealIntakeInput & {
  actorUserId: string;
  dealId: string;
};

export class UpdateDealIntakeCommand {
  private readonly replaceIntakeCommand: ReplaceDealIntakeCommand;

  constructor(
    runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    references: DealReferencesPort,
  ) {
    this.replaceIntakeCommand = new ReplaceDealIntakeCommand(
      runtime,
      commandUow,
      references,
    );
  }

  async execute(raw: UpdateDealIntakeCommandInput): Promise<DealDetails> {
    const validated = UpdateDealIntakeCommandInputSchema.parse(raw);
    const existing = await this.commandUow.run((tx) =>
      tx.dealReads.findWorkflowById(validated.dealId),
    );

    if (!existing) {
      throw new DealNotFoundError(validated.dealId);
    }

    const updated = await this.replaceIntakeCommand.execute({
      actorUserId: validated.actorUserId,
      dealId: validated.dealId,
      expectedRevision: existing.revision,
      intake: applyLegacyIntakePatch({
        current: existing.intake,
        patch: validated,
      }),
    });

    if (validated.agentId !== undefined) {
      await this.commandUow.run((tx) =>
        tx.dealStore.setDealRoot({
          agentId: validated.agentId ?? null,
          dealId: validated.dealId,
        }),
      );
    }

    return this.commandUow.run(async (tx) => {
      const detail = await tx.dealReads.findById(updated.summary.id);

      if (!detail) {
        throw new DealNotFoundError(updated.summary.id);
      }

      return detail;
    });
  }
}
