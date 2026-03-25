import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

export const SubAgentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  commission: z.number(),
});

export type SubAgent = z.infer<typeof SubAgentSchema>;

export const PaginatedSubAgentsSchema =
  createPaginatedListSchema(SubAgentSchema);

export type PaginatedSubAgents = z.infer<typeof PaginatedSubAgentsSchema>;
