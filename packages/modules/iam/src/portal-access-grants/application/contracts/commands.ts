import { z } from "zod";

const PORTAL_ACCESS_GRANT_STATUS_VALUES = [
  "pending_onboarding",
  "consumed",
  "revoked",
] as const;

export const PortalAccessGrantStatusSchema = z.enum(
  PORTAL_ACCESS_GRANT_STATUS_VALUES,
);

export const CreatePortalAccessGrantInputSchema = z.object({
  status: PortalAccessGrantStatusSchema.default("pending_onboarding"),
  userId: z.string().min(1),
});

export type CreatePortalAccessGrantInput = z.input<
  typeof CreatePortalAccessGrantInputSchema
>;

export const ConsumePortalAccessGrantInputSchema = z.object({
  userId: z.string().min(1),
});

export type ConsumePortalAccessGrantInput = z.infer<
  typeof ConsumePortalAccessGrantInputSchema
>;

export const RevokePortalAccessGrantInputSchema = z.object({
  userId: z.string().min(1),
});

export type RevokePortalAccessGrantInput = z.infer<
  typeof RevokePortalAccessGrantInputSchema
>;
