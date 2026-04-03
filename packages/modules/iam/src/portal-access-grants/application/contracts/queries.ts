import { z } from "zod";

export const GetPortalAccessGrantByUserIdInputSchema = z.object({
  userId: z.string().min(1),
});

export type GetPortalAccessGrantByUserIdInput = z.infer<
  typeof GetPortalAccessGrantByUserIdInputSchema
>;

export const HasPendingPortalAccessGrantInputSchema = z.object({
  userId: z.string().min(1),
});

export type HasPendingPortalAccessGrantInput = z.infer<
  typeof HasPendingPortalAccessGrantInputSchema
>;
