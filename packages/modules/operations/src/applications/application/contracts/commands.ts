import { z } from "zod";

import { APPLICATION_STATUS_VALUES } from "../../domain/application-status";

export const CreateApplicationInputSchema = z.object({
  agentId: z.number().int().nullable().optional(),
  clientId: z.number().int(),
  source: z.enum(["web", "bot"]).default("web"),
  requestedAmount: z.string().optional(),
  requestedCurrency: z.string().optional(),
});

export type CreateApplicationInput = z.infer<
  typeof CreateApplicationInputSchema
>;

export const UpdateApplicationStatusInputSchema = z.object({
  id: z.number().int(),
  status: z.enum(APPLICATION_STATUS_VALUES),
  reason: z.string().optional(),
});

export type UpdateApplicationStatusInput = z.infer<
  typeof UpdateApplicationStatusInputSchema
>;

export const UpdateApplicationCommentInputSchema = z.object({
  id: z.number().int(),
  comment: z.string(),
});

export type UpdateApplicationCommentInput = z.infer<
  typeof UpdateApplicationCommentInputSchema
>;

export const TakeApplicationInputSchema = z.object({
  applicationId: z.number().int(),
  agentId: z.number().int(),
});

export type TakeApplicationInput = z.infer<typeof TakeApplicationInputSchema>;
