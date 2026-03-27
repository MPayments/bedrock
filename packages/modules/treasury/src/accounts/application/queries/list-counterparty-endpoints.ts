import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toCounterpartyEndpointDto } from "../../../shared/application/mappers";
import {
  ListCounterpartyEndpointsInputSchema,
  type ListCounterpartyEndpointsInput,
} from "../../contracts";

export class ListCounterpartyEndpointsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListCounterpartyEndpointsInput = {}) {
    const validated = ListCounterpartyEndpointsInputSchema.parse(input);
    const records = await this.context.reads.listCounterpartyEndpoints(validated);

    return records.map(toCounterpartyEndpointDto);
  }
}
