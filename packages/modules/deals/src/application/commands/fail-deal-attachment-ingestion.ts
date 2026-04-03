import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  FailDealAttachmentIngestionInputSchema,
  type FailDealAttachmentIngestionInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class FailDealAttachmentIngestionCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  execute(raw: FailDealAttachmentIngestionInput) {
    const validated = FailDealAttachmentIngestionInputSchema.parse(raw);
    const nextStatus = validated.retryAt ? "pending" : "failed";

    return this.commandUow.run((tx) =>
      tx.dealStore.setDealAttachmentIngestion({
        availableAt: validated.retryAt ?? this.runtime.now(),
        errorCode: validated.errorCode,
        errorMessage: validated.errorMessage,
        fileAssetId: validated.fileAssetId,
        ...(validated.retryAt
          ? {}
          : {
              lastProcessedAt: this.runtime.now(),
            }),
        status: nextStatus,
      }),
    );
  }
}
