import { z } from "zod";

import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { TreasuryEntityNotFoundError } from "../../../errors";

const ListOperationDocumentLinksInputSchema = z.object({
  operationId: z.uuid(),
});

export class ListOperationDocumentLinksQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: { operationId: string }) {
    const validated = ListOperationDocumentLinksInputSchema.parse(input);
    const operation = await this.context.reads.findOperation(validated.operationId);

    if (!operation) {
      throw new TreasuryEntityNotFoundError("Operation", validated.operationId);
    }

    const [obligationLinks, instructions] = await Promise.all([
      this.context.reads.listOperationObligationLinks(operation.id),
      this.context.reads.listOperationInstructions(operation.id),
    ]);

    return this.context.reads.listDocumentLinksByTargetIds(
      [
        operation.id,
        ...obligationLinks.map((link) => link.obligationId),
        ...instructions.map((instruction) => instruction.id),
      ],
      {
        linkKinds: ["operation", "obligation", "instruction"],
      },
    );
  }
}
