import { z } from "zod";

import type { DealPricingContext } from "../contracts/dto";
import type { DealReads } from "../ports/deal.reads";

const FindDealPricingContextByDealIdQuerySchema = z.object({
  dealId: z.uuid(),
});

type FindDealPricingContextByDealIdQueryInput = z.infer<
  typeof FindDealPricingContextByDealIdQuerySchema
>;

export class FindDealPricingContextByDealIdQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(
    raw: FindDealPricingContextByDealIdQueryInput,
  ): Promise<DealPricingContext> {
    const validated = FindDealPricingContextByDealIdQuerySchema.parse(raw);
    return this.reads.findPricingContextByDealId(validated.dealId);
  }
}
