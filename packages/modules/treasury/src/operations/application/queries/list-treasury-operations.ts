import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryOperationDto } from "../../../shared/application/mappers";
import {
  ListTreasuryOperationsInputSchema,
  type ListTreasuryOperationsInput,
} from "../../contracts";

export class ListTreasuryOperationsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListTreasuryOperationsInput = {}) {
    const validated = ListTreasuryOperationsInputSchema.parse(input);
    const records = await this.context.reads.listTreasuryOperations(validated);

    return records.map(toTreasuryOperationDto);
  }
}
