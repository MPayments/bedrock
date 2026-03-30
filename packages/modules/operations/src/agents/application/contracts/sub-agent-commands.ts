import { z } from "zod";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "@bedrock/parties/contracts";

export const CreateSubAgentInputSchema = z.object({
  name: z.string().min(1),
  commission: z.number().min(0),
  kind: PartyKindSchema.default("individual"),
  country: CountryCodeSchema.nullable().optional(),
});

export type CreateSubAgentInput = z.infer<typeof CreateSubAgentInputSchema>;

export const UpdateSubAgentInputSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).optional(),
  commission: z.number().min(0).optional(),
  kind: PartyKindSchema.optional(),
  country: CountryCodeSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSubAgentInput = z.infer<typeof UpdateSubAgentInputSchema>;
