import { z } from "zod";

export const SetAgentBonusInputSchema = z.object({
  agentId: z.string(),
  dealId: z.number().int(),
  commission: z.string(),
});

export type SetAgentBonusInput = z.infer<typeof SetAgentBonusInputSchema>;
