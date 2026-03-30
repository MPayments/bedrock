import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";
import {
  PartyKindSchema,
} from "@bedrock/parties/contracts";

export const SubAgentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  commission: z.number(),
  kind: PartyKindSchema,
  isActive: z.boolean(),
});

export type SubAgent = z.infer<typeof SubAgentSchema>;

export const PaginatedSubAgentsSchema =
  createPaginatedListSchema(SubAgentSchema);

export type PaginatedSubAgents = z.infer<typeof PaginatedSubAgentsSchema>;
