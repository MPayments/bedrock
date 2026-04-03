import { z } from "zod";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateDealDraftCommand } from "./create-deal-draft";
import { DealNotFoundError } from "../../errors";
import {
  CreateDealInputSchema,
  type CreateDealInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";
import { buildLegacyCreateIntakeDraft } from "../shared/workflow-state";

const CreateDealCommandInputSchema = CreateDealInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

type CreateDealCommandInput = CreateDealInput & {
  actorUserId: string;
  idempotencyKey: string;
};

export class CreateDealCommand {
  private readonly createDraftCommand: CreateDealDraftCommand;

  constructor(
    runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
    idempotency: IdempotencyPort,
    references: DealReferencesPort,
  ) {
    this.createDraftCommand = new CreateDealDraftCommand(
      runtime,
      commandUow,
      idempotency,
      references,
    );
  }

  async execute(raw: CreateDealCommandInput): Promise<DealDetails> {
    const validated = CreateDealCommandInputSchema.parse(raw);
    const created = await this.createDraftCommand.execute({
      actorUserId: validated.actorUserId,
      agreementId: validated.agreementId,
      customerId: validated.customerId,
      idempotencyKey: validated.idempotencyKey,
      intake: buildLegacyCreateIntakeDraft(validated),
    });

    return this.commandUow.run(async (tx) => {
      const detail = await tx.dealReads.findById(created.summary.id);

      if (!detail) {
        throw new DealNotFoundError(created.summary.id);
      }

      return detail;
    });
  }
}
