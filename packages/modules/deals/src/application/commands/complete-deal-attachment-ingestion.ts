import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CompleteDealAttachmentIngestionInputSchema,
  type CompleteDealAttachmentIngestionInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class CompleteDealAttachmentIngestionCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  execute(raw: CompleteDealAttachmentIngestionInput) {
    const validated = CompleteDealAttachmentIngestionInputSchema.parse(raw);

    return this.commandUow.run((tx) =>
      tx.dealStore.setDealAttachmentIngestion({
        appliedFields: validated.appliedFields,
        appliedRevision: validated.appliedRevision,
        fileAssetId: validated.fileAssetId,
        lastProcessedAt: this.runtime.now(),
        normalizedPayload: validated.normalizedPayload,
        skippedFields: validated.skippedFields,
        status: "processed",
      }),
    );
  }
}
