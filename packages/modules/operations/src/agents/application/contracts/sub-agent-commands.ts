import { z } from "zod";

export const CreateSubAgentInputSchema = z.object({
  name: z.string().min(1),
  commission: z.number().min(0),
});

export type CreateSubAgentInput = z.infer<typeof CreateSubAgentInputSchema>;

export const UpdateSubAgentInputSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).optional(),
  commission: z.number().min(0).optional(),
});

export type UpdateSubAgentInput = z.infer<typeof UpdateSubAgentInputSchema>;
