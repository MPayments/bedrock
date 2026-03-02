import { z } from "zod";

const bigintLikeSchema = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((value) => BigInt(value));

export const RouteDirectionSchema = z.enum(["payin", "payout"]);

export const PlanRouteInputSchema = z.object({
  intentId: z.uuid().optional(),
  direction: RouteDirectionSchema,
  amountMinor: bigintLikeSchema,
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase()),
  corridor: z.string().trim().min(1).max(128),
  countryFrom: z.string().trim().min(2).max(2).optional(),
  countryTo: z.string().trim().min(2).max(2).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  bookId: z.string().trim().min(1),
});

export const CreateRoutingRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  priority: z.number().int().nonnegative(),
  enabled: z.boolean().default(true),
  direction: RouteDirectionSchema.optional(),
  corridor: z.string().trim().min(1).max(128).optional(),
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase())
    .optional(),
  countryFrom: z.string().trim().min(2).max(2).optional(),
  countryTo: z.string().trim().min(2).max(2).optional(),
  amountMinMinor: bigintLikeSchema.optional(),
  amountMaxMinor: bigintLikeSchema.optional(),
  riskMin: z.number().int().min(0).max(100).optional(),
  riskMax: z.number().int().min(0).max(100).optional(),
  preferredProviders: z.array(z.string().trim().min(1).max(128)).optional(),
  degradationOrder: z.array(z.string().trim().min(1).max(128)).optional(),
  weightCost: z.number().int().nonnegative().optional(),
  weightFx: z.number().int().nonnegative().optional(),
  weightSla: z.number().int().nonnegative().optional(),
  weightHealth: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateRoutingRuleInputSchema =
  CreateRoutingRuleInputSchema.partial().extend({
    id: z.uuid(),
  });

export const CreateProviderCorridorInputSchema = z.object({
  providerCode: z.string().trim().min(1).max(128),
  corridor: z.string().trim().min(1).max(128),
  direction: RouteDirectionSchema,
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase()),
  countryFrom: z.string().trim().min(2).max(2).optional(),
  countryTo: z.string().trim().min(2).max(2).optional(),
  supportsWebhooks: z.boolean().optional(),
  pollingRequired: z.boolean().optional(),
  slaScore: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateProviderCorridorInputSchema =
  CreateProviderCorridorInputSchema.partial().extend({
    id: z.uuid(),
  });

export const CreateProviderFeeScheduleInputSchema = z.object({
  providerCode: z.string().trim().min(1).max(128),
  corridor: z.string().trim().min(1).max(128),
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase()),
  fixedFeeMinor: bigintLikeSchema.default(0n),
  bps: z.number().int().min(0).default(0),
  fxMarkupBps: z.number().int().min(0).default(0),
  effectiveFrom: z.date().optional(),
  effectiveTo: z.date().optional(),
});

export const UpdateProviderFeeScheduleInputSchema =
  CreateProviderFeeScheduleInputSchema.partial().extend({
    id: z.uuid(),
  });

export const CreateProviderLimitInputSchema = z.object({
  providerCode: z.string().trim().min(1).max(128),
  corridor: z.string().trim().min(1).max(128),
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase()),
  minAmountMinor: bigintLikeSchema,
  maxAmountMinor: bigintLikeSchema,
  dailyVolumeMinor: bigintLikeSchema.optional(),
  dailyCount: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

export const UpdateProviderLimitInputSchema =
  CreateProviderLimitInputSchema.partial().extend({
    id: z.uuid(),
  });

export const CreateScopeOverrideInputSchema = z.object({
  scopeType: z.literal("book").default("book"),
  scopeId: z.string().trim().min(1),
  routingRuleId: z.uuid(),
  overrideConfig: z.record(z.string(), z.unknown()),
});

export const UpdateScopeOverrideInputSchema =
  CreateScopeOverrideInputSchema.partial().extend({
    id: z.uuid(),
  });

export type PlanRouteInput = z.infer<typeof PlanRouteInputSchema>;
export type CreateRoutingRuleInput = z.infer<
  typeof CreateRoutingRuleInputSchema
>;
export type UpdateRoutingRuleInput = z.infer<
  typeof UpdateRoutingRuleInputSchema
>;
export type CreateProviderCorridorInput = z.infer<
  typeof CreateProviderCorridorInputSchema
>;
export type UpdateProviderCorridorInput = z.infer<
  typeof UpdateProviderCorridorInputSchema
>;
export type CreateProviderFeeScheduleInput = z.infer<
  typeof CreateProviderFeeScheduleInputSchema
>;
export type UpdateProviderFeeScheduleInput = z.infer<
  typeof UpdateProviderFeeScheduleInputSchema
>;
export type CreateProviderLimitInput = z.infer<
  typeof CreateProviderLimitInputSchema
>;
export type UpdateProviderLimitInput = z.infer<
  typeof UpdateProviderLimitInputSchema
>;
export type CreateScopeOverrideInput = z.infer<
  typeof CreateScopeOverrideInputSchema
>;
export type UpdateScopeOverrideInput = z.infer<
  typeof UpdateScopeOverrideInputSchema
>;
