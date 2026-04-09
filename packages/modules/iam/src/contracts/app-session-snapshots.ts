import { z } from "zod";

import { UserRoleSchema } from "./zod";

export const AUTH_AUDIENCE_VALUES = ["finance", "crm", "portal"] as const;

export const AuthAudienceSchema = z.enum(AUTH_AUDIENCE_VALUES);

export type AuthAudience = z.infer<typeof AuthAudienceSchema>;

export const AppSessionSchema = z.object({
  expiresAt: z.string().nullable(),
  id: z.string(),
});

export type AppSession = z.infer<typeof AppSessionSchema>;

export const AppSessionUserSchema = z.object({
  email: z.string(),
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
});

export type AppSessionUser = z.infer<typeof AppSessionUserSchema>;

export const CustomerPortalCustomerSummarySchema = z.object({
  description: z.string().nullable(),
  name: z.string(),
  externalRef: z.string().nullable(),
  id: z.string(),
});

export type CustomerPortalCustomerSummary = z.infer<
  typeof CustomerPortalCustomerSummarySchema
>;

export const CrmSessionRoleSchema = z.enum(["admin", "agent"]).nullable();

export type CrmSessionRole = z.infer<typeof CrmSessionRoleSchema>;

export const CrmSessionSnapshotSchema = z.object({
  audience: z.literal("crm"),
  canAccessDashboard: z.boolean(),
  customerPortalCustomers: z.array(CustomerPortalCustomerSummarySchema),
  hasCustomerPortalAccess: z.boolean(),
  isAuthenticated: z.boolean(),
  role: CrmSessionRoleSchema,
  session: AppSessionSchema.nullable(),
  user: AppSessionUserSchema.nullable(),
});

export type CrmSessionSnapshot = z.infer<typeof CrmSessionSnapshotSchema>;

export const FinanceSessionRoleSchema = z.enum(["admin", "finance"]);

export type FinanceSessionRole = z.infer<typeof FinanceSessionRoleSchema>;

export const FinanceAuthSessionSnapshotSchema = z.object({
  audience: z.literal("finance"),
  isAuthenticated: z.boolean(),
  requiresTwoFactorSetup: z.boolean(),
  role: FinanceSessionRoleSchema,
  session: AppSessionSchema.nullable(),
  user: AppSessionUserSchema.nullable(),
});

export type FinanceAuthSessionSnapshot = z.infer<
  typeof FinanceAuthSessionSnapshotSchema
>;

export const PortalSessionSnapshotSchema = z.object({
  audience: z.literal("portal"),
  canAccessDashboard: z.boolean(),
  customerPortalCustomers: z.array(CustomerPortalCustomerSummarySchema),
  hasCustomerPortalAccess: z.boolean(),
  hasOnboardingAccess: z.boolean(),
  isAuthenticated: z.boolean(),
  role: UserRoleSchema.nullable(),
  session: AppSessionSchema.nullable(),
  user: AppSessionUserSchema.nullable(),
});

export type PortalSessionSnapshot = z.infer<typeof PortalSessionSnapshotSchema>;

export const AppSessionSnapshotSchema = z.discriminatedUnion("audience", [
  CrmSessionSnapshotSchema,
  FinanceAuthSessionSnapshotSchema,
  PortalSessionSnapshotSchema,
]);

export type AppSessionSnapshot = z.infer<typeof AppSessionSnapshotSchema>;
