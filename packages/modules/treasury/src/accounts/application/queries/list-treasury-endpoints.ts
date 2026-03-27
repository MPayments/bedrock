import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryEndpointDto } from "../../../shared/application/mappers";
import {
  ListTreasuryEndpointsInputSchema,
  type ListTreasuryEndpointsInput,
} from "../../contracts";

export class ListTreasuryEndpointsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListTreasuryEndpointsInput = {}) {
    const validated = ListTreasuryEndpointsInputSchema.parse(input);
    const records = await this.context.reads.listTreasuryEndpoints(validated);

    return records.map(toTreasuryEndpointDto);
  }
}
