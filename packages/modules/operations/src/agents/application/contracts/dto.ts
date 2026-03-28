import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

export const AgentProfileSchema = z.object({
  id: z.string(),
  tgId: z.number().nullable(),
  userName: z.string().nullable(),
  name: z.string(),
  tag: z.string().nullable(),
  status: z.string().nullable(),
  isAllowed: z.boolean().nullable(),
  isAdmin: z.boolean().nullable(),
  role: z.string().nullable(),
  email: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

export const PaginatedAgentsSchema =
  createPaginatedListSchema(AgentProfileSchema);

export type PaginatedAgents = z.infer<typeof PaginatedAgentsSchema>;
