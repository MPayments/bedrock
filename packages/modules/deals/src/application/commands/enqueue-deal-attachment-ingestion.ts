import { ValidationError } from "@bedrock/shared/core/errors";
import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  EnqueueDealAttachmentIngestionInputSchema,
  type EnqueueDealAttachmentIngestionInput,
} from "../contracts/commands";
import type { DealAttachmentIngestion } from "../contracts/dto";
import { DealNotFoundError } from "../../errors";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class EnqueueDealAttachmentIngestionCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: EnqueueDealAttachmentIngestionInput,
  ): Promise<DealAttachmentIngestion> {
    const validated = EnqueueDealAttachmentIngestionInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.upsertDealAttachmentIngestion({
        availableAt: this.runtime.now(),
        dealId: validated.dealId,
        fileAssetId: validated.fileAssetId,
        id: this.runtime.generateUuid(),
        observedRevision: existing.revision,
      });

      const ingestion = await tx.dealReads.findAttachmentIngestionByFileAssetId(
        validated.fileAssetId,
      );

      if (!ingestion) {
        throw new ValidationError("Attachment ingestion was not persisted");
      }

      return ingestion;
    });
  }
}
