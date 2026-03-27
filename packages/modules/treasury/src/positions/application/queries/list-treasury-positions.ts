import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryPositionDto } from "../../../shared/application/mappers";
import {
  ListTreasuryPositionsInputSchema,
  type ListTreasuryPositionsInput,
} from "../../contracts";

export class ListTreasuryPositionsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListTreasuryPositionsInput = {}) {
    const validated = ListTreasuryPositionsInputSchema.parse(input);
    const rows = await this.context.reads.listTreasuryPositions(validated);

    return rows.map(toTreasuryPositionDto);
  }
}
