import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toOperationTimelineItemDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  GetOperationTimelineInputSchema,
  type GetOperationTimelineInput,
} from "../../contracts";

export class GetOperationTimelineQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: GetOperationTimelineInput) {
    const validated = GetOperationTimelineInputSchema.parse(input);
    const operation = await this.context.reads.findOperation(validated.operationId);
    if (!operation) {
      throw new TreasuryEntityNotFoundError("Operation", validated.operationId);
    }

    const [links, instructions, events, positions] = await Promise.all([
      this.context.reads.listOperationObligationLinks(operation.id),
      this.context.reads.listOperationInstructions(operation.id),
      this.context.reads.listOperationEvents(operation.id),
      this.context.reads.listTreasuryPositions({ originOperationId: operation.id }),
    ]);
    const obligations = await this.context.reads.listObligationsByIds(
      links.map((link) => link.obligationId),
    );
    const obligationsById = new Map(
      obligations.map((obligation) => [obligation.id, obligation]),
    );

    return toOperationTimelineItemDto({
      operation,
      obligations: links
        .map((link) => obligationsById.get(link.obligationId))
        .filter((value) => value !== undefined),
      instructions,
      events,
      positions,
    });
  }
}
