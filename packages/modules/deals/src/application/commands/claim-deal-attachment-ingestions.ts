import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ClaimDealAttachmentIngestionsInputSchema,
  type ClaimDealAttachmentIngestionsInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class ClaimDealAttachmentIngestionsCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  execute(raw: ClaimDealAttachmentIngestionsInput) {
    const validated = ClaimDealAttachmentIngestionsInputSchema.parse(raw);

    return this.commandUow.run((tx) =>
      tx.dealStore.claimAttachmentIngestions({
        batchSize: validated.batchSize,
        leaseSeconds: validated.leaseSeconds,
        now: this.runtime.now(),
      }),
    );
  }
}
