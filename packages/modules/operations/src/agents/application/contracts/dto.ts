import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

export const AgentProfileSchema = z.object({
  id: z.number().int(),
  tgId: z.number().nullable(),
  userName: z.string().nullable(),
  name: z.string(),
  tag: z.string().nullable(),
  status: z.string(),
  isAllowed: z.boolean(),
  isAdmin: z.boolean(),
  role: z.string(),
  email: z.string().nullable(),
  bedrockUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

export const PaginatedAgentsSchema =
  createPaginatedListSchema(AgentProfileSchema);

export type PaginatedAgents = z.infer<typeof PaginatedAgentsSchema>;
