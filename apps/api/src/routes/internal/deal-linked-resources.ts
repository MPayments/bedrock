import { z } from "@hono/zod-openapi";

import { NotFoundError } from "@bedrock/shared/core/errors";

import type { AppContext } from "../../context";

export const DealScopedCreateDocumentInputSchema = z.object({
  dealId: z.string().uuid().optional(),
  input: z.unknown(),
});

export async function requireDeal(ctx: AppContext, dealId: string) {
  const deal = await ctx.dealsModule.deals.queries.findById(dealId);

  if (!deal) {
    throw new NotFoundError("Deal", dealId);
  }

  return deal;
}
