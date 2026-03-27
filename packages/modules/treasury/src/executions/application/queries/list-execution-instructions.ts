import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toExecutionInstructionDto } from "../../../shared/application/mappers";
import {
  ListExecutionInstructionsInputSchema,
  type ListExecutionInstructionsInput,
} from "../../contracts";

export class ListExecutionInstructionsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListExecutionInstructionsInput = {}) {
    const validated = ListExecutionInstructionsInputSchema.parse(input);
    const records = await this.context.reads.listExecutionInstructions(validated);

    return records.map(toExecutionInstructionDto);
  }
}
