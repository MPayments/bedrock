import { DealNotFoundError } from "../../errors";
import type { DealTraceProjection } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

export class FindDealTraceByIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(id: string): Promise<DealTraceProjection> {
    const trace = await this.reads.findTraceById(id);

    if (!trace) {
      throw new DealNotFoundError(id);
    }

    return trace;
  }
}
