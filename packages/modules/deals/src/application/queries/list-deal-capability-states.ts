import {
  ListDealCapabilityStatesQuerySchema,
  type ListDealCapabilityStatesQuery as ListDealCapabilityStatesQueryInput,
} from "../contracts/commands";
import type { DealCapabilityState } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class ListDealCapabilityStatesQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(
    input?: ListDealCapabilityStatesQueryInput,
  ): Promise<DealCapabilityState[]> {
    const query = ListDealCapabilityStatesQuerySchema.parse(input ?? {});
    return this.reads.listCapabilityStates(query);
  }
}
