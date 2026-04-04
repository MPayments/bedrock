import { z } from "zod";

import { DealNotFoundError } from "../../errors";
import { UpdateDealCommentInputSchema } from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

const UpdateDealCommentCommandInputSchema = UpdateDealCommentInputSchema.extend({
  dealId: z.uuid(),
});

type UpdateDealCommentCommandInput = z.infer<
  typeof UpdateDealCommentCommandInputSchema
>;

export class UpdateDealCommentCommand {
  constructor(private readonly commandUow: DealsCommandUnitOfWork) {}

  async execute(raw: UpdateDealCommentCommandInput): Promise<DealDetails> {
    const validated = UpdateDealCommentCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findById(validated.dealId);

      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.setDealRoot({
        comment: validated.comment ?? null,
        dealId: validated.dealId,
      });

      const updated = await tx.dealReads.findById(validated.dealId);

      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
