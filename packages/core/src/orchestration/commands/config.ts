import { eq } from "drizzle-orm";

import { schema } from "@bedrock/core/orchestration/schema";

import {
  ProviderCorridorNotFoundError,
  ProviderFeeScheduleNotFoundError,
  ProviderLimitNotFoundError,
  RoutingRuleNotFoundError,
  ScopeOverrideNotFoundError,
} from "../errors";
import type { OrchestrationServiceContext } from "../internal/context";
import {
  CreateProviderCorridorInputSchema,
  CreateProviderFeeScheduleInputSchema,
  CreateProviderLimitInputSchema,
  CreateRoutingRuleInputSchema,
  CreateScopeOverrideInputSchema,
  UpdateProviderCorridorInputSchema,
  UpdateProviderFeeScheduleInputSchema,
  UpdateProviderLimitInputSchema,
  UpdateRoutingRuleInputSchema,
  UpdateScopeOverrideInputSchema,
  type CreateProviderCorridorInput,
  type CreateProviderFeeScheduleInput,
  type CreateProviderLimitInput,
  type CreateRoutingRuleInput,
  type CreateScopeOverrideInput,
  type UpdateProviderCorridorInput,
  type UpdateProviderFeeScheduleInput,
  type UpdateProviderLimitInput,
  type UpdateRoutingRuleInput,
  type UpdateScopeOverrideInput,
} from "../validation";

export interface OrchestrationConfigHandlers {
  listRoutingRules: () => Promise<unknown[]>;
  createRoutingRule: (input: CreateRoutingRuleInput) => Promise<unknown>;
  updateRoutingRule: (input: UpdateRoutingRuleInput) => Promise<unknown>;
  deleteRoutingRule: (id: string) => Promise<unknown>;
  listProviderCorridors: () => Promise<unknown[]>;
  createProviderCorridor: (input: CreateProviderCorridorInput) => Promise<unknown>;
  updateProviderCorridor: (input: UpdateProviderCorridorInput) => Promise<unknown>;
  deleteProviderCorridor: (id: string) => Promise<unknown>;
  listProviderFeeSchedules: () => Promise<unknown[]>;
  createProviderFeeSchedule: (
    input: CreateProviderFeeScheduleInput,
  ) => Promise<unknown>;
  updateProviderFeeSchedule: (
    input: UpdateProviderFeeScheduleInput,
  ) => Promise<unknown>;
  deleteProviderFeeSchedule: (id: string) => Promise<unknown>;
  listProviderLimits: () => Promise<unknown[]>;
  createProviderLimit: (input: CreateProviderLimitInput) => Promise<unknown>;
  updateProviderLimit: (input: UpdateProviderLimitInput) => Promise<unknown>;
  deleteProviderLimit: (id: string) => Promise<unknown>;
  listScopeOverrides: (input?: { scopeType?: "book"; scopeId?: string }) => Promise<
    unknown[]
  >;
  createScopeOverride: (input: CreateScopeOverrideInput) => Promise<unknown>;
  updateScopeOverride: (input: UpdateScopeOverrideInput) => Promise<unknown>;
  deleteScopeOverride: (id: string) => Promise<unknown>;
}

export function createConfigHandlers(
  context: OrchestrationServiceContext,
): OrchestrationConfigHandlers {
  const { db } = context;

  async function listRoutingRules() {
    return db
      .select()
      .from(schema.routingRules)
      .orderBy(schema.routingRules.priority, schema.routingRules.name);
  }

  async function createRoutingRule(input: CreateRoutingRuleInput) {
    const validated = CreateRoutingRuleInputSchema.parse(input);
    const [created] = await db
      .insert(schema.routingRules)
      .values({
        ...validated,
        enabled: validated.enabled ?? true,
        preferredProviders: validated.preferredProviders ?? null,
        degradationOrder: validated.degradationOrder ?? null,
        weightCost: validated.weightCost ?? 40,
        weightFx: validated.weightFx ?? 20,
        weightSla: validated.weightSla ?? 20,
        weightHealth: validated.weightHealth ?? 20,
        metadata: validated.metadata ?? null,
      })
      .returning();

    return created!;
  }

  async function updateRoutingRule(input: UpdateRoutingRuleInput) {
    const validated = UpdateRoutingRuleInputSchema.parse(input);
    const [updated] = await db
      .update(schema.routingRules)
      .set({
        ...validated,
        id: undefined,
      })
      .where(eq(schema.routingRules.id, validated.id))
      .returning();

    if (!updated) {
      throw new RoutingRuleNotFoundError(validated.id);
    }
    return updated;
  }

  async function deleteRoutingRule(id: string) {
    const [deleted] = await db
      .delete(schema.routingRules)
      .where(eq(schema.routingRules.id, id))
      .returning({ id: schema.routingRules.id });
    if (!deleted) {
      throw new RoutingRuleNotFoundError(id);
    }
    return deleted;
  }

  async function listProviderCorridors() {
    return db
      .select()
      .from(schema.providerCorridors)
      .orderBy(
        schema.providerCorridors.providerCode,
        schema.providerCorridors.corridor,
      );
  }

  async function createProviderCorridor(input: CreateProviderCorridorInput) {
    const validated = CreateProviderCorridorInputSchema.parse(input);
    const [created] = await db
      .insert(schema.providerCorridors)
      .values({
        ...validated,
        supportsWebhooks: validated.supportsWebhooks ?? true,
        pollingRequired: validated.pollingRequired ?? false,
        slaScore: validated.slaScore ?? 50,
        enabled: validated.enabled ?? true,
        metadata: validated.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [
          schema.providerCorridors.providerCode,
          schema.providerCorridors.corridor,
          schema.providerCorridors.direction,
          schema.providerCorridors.currency,
        ],
        set: {
          countryFrom: validated.countryFrom ?? null,
          countryTo: validated.countryTo ?? null,
          supportsWebhooks: validated.supportsWebhooks ?? true,
          pollingRequired: validated.pollingRequired ?? false,
          slaScore: validated.slaScore ?? 50,
          enabled: validated.enabled ?? true,
          metadata: validated.metadata ?? null,
        },
      })
      .returning();

    return created!;
  }

  async function updateProviderCorridor(input: UpdateProviderCorridorInput) {
    const validated = UpdateProviderCorridorInputSchema.parse(input);
    const [updated] = await db
      .update(schema.providerCorridors)
      .set({
        ...validated,
        id: undefined,
      })
      .where(eq(schema.providerCorridors.id, validated.id))
      .returning();

    if (!updated) {
      throw new ProviderCorridorNotFoundError(validated.id);
    }
    return updated;
  }

  async function deleteProviderCorridor(id: string) {
    const [deleted] = await db
      .delete(schema.providerCorridors)
      .where(eq(schema.providerCorridors.id, id))
      .returning({ id: schema.providerCorridors.id });
    if (!deleted) {
      throw new ProviderCorridorNotFoundError(id);
    }
    return deleted;
  }

  async function listProviderFeeSchedules() {
    return db
      .select()
      .from(schema.providerFeeSchedules)
      .orderBy(
        schema.providerFeeSchedules.providerCode,
        schema.providerFeeSchedules.corridor,
      );
  }

  async function createProviderFeeSchedule(
    input: CreateProviderFeeScheduleInput,
  ) {
    const validated = CreateProviderFeeScheduleInputSchema.parse(input);
    const [created] = await db
      .insert(schema.providerFeeSchedules)
      .values({
        ...validated,
        effectiveFrom: validated.effectiveFrom ?? new Date(),
      })
      .returning();
    return created!;
  }

  async function updateProviderFeeSchedule(
    input: UpdateProviderFeeScheduleInput,
  ) {
    const validated = UpdateProviderFeeScheduleInputSchema.parse(input);
    const [updated] = await db
      .update(schema.providerFeeSchedules)
      .set({
        ...validated,
        id: undefined,
      })
      .where(eq(schema.providerFeeSchedules.id, validated.id))
      .returning();

    if (!updated) {
      throw new ProviderFeeScheduleNotFoundError(validated.id);
    }
    return updated;
  }

  async function deleteProviderFeeSchedule(id: string) {
    const [deleted] = await db
      .delete(schema.providerFeeSchedules)
      .where(eq(schema.providerFeeSchedules.id, id))
      .returning({ id: schema.providerFeeSchedules.id });
    if (!deleted) {
      throw new ProviderFeeScheduleNotFoundError(id);
    }
    return deleted;
  }

  async function listProviderLimits() {
    return db
      .select()
      .from(schema.providerLimits)
      .orderBy(
        schema.providerLimits.providerCode,
        schema.providerLimits.corridor,
      );
  }

  async function createProviderLimit(input: CreateProviderLimitInput) {
    const validated = CreateProviderLimitInputSchema.parse(input);
    const [created] = await db
      .insert(schema.providerLimits)
      .values({
        ...validated,
        enabled: validated.enabled ?? true,
      })
      .onConflictDoUpdate({
        target: [
          schema.providerLimits.providerCode,
          schema.providerLimits.corridor,
          schema.providerLimits.currency,
        ],
        set: {
          minAmountMinor: validated.minAmountMinor,
          maxAmountMinor: validated.maxAmountMinor,
          dailyVolumeMinor: validated.dailyVolumeMinor ?? null,
          dailyCount: validated.dailyCount ?? null,
          enabled: validated.enabled ?? true,
        },
      })
      .returning();

    return created!;
  }

  async function updateProviderLimit(input: UpdateProviderLimitInput) {
    const validated = UpdateProviderLimitInputSchema.parse(input);
    const [updated] = await db
      .update(schema.providerLimits)
      .set({
        ...validated,
        id: undefined,
      })
      .where(eq(schema.providerLimits.id, validated.id))
      .returning();
    if (!updated) {
      throw new ProviderLimitNotFoundError(validated.id);
    }
    return updated;
  }

  async function deleteProviderLimit(id: string) {
    const [deleted] = await db
      .delete(schema.providerLimits)
      .where(eq(schema.providerLimits.id, id))
      .returning({ id: schema.providerLimits.id });
    if (!deleted) {
      throw new ProviderLimitNotFoundError(id);
    }
    return deleted;
  }

  async function listScopeOverrides(input?: {
    scopeType?: "book";
    scopeId?: string;
  }) {
    return db
      .select()
      .from(schema.orchestrationScopeOverrides)
      .where(
        input?.scopeType && input?.scopeId
          ? eq(schema.orchestrationScopeOverrides.scopeId, input.scopeId)
          : undefined,
      );
  }

  async function createScopeOverride(input: CreateScopeOverrideInput) {
    const validated = CreateScopeOverrideInputSchema.parse(input);
    const [created] = await db
      .insert(schema.orchestrationScopeOverrides)
      .values(validated)
      .onConflictDoUpdate({
        target: [
          schema.orchestrationScopeOverrides.scopeType,
          schema.orchestrationScopeOverrides.scopeId,
          schema.orchestrationScopeOverrides.routingRuleId,
        ],
        set: {
          overrideConfig: validated.overrideConfig,
        },
      })
      .returning();

    return created!;
  }

  async function updateScopeOverride(input: UpdateScopeOverrideInput) {
    const validated = UpdateScopeOverrideInputSchema.parse(input);
    const [updated] = await db
      .update(schema.orchestrationScopeOverrides)
      .set({
        ...validated,
        id: undefined,
      })
      .where(eq(schema.orchestrationScopeOverrides.id, validated.id))
      .returning();
    if (!updated) {
      throw new ScopeOverrideNotFoundError(validated.id);
    }
    return updated;
  }

  async function deleteScopeOverride(id: string) {
    const [deleted] = await db
      .delete(schema.orchestrationScopeOverrides)
      .where(eq(schema.orchestrationScopeOverrides.id, id))
      .returning({ id: schema.orchestrationScopeOverrides.id });
    if (!deleted) {
      throw new ScopeOverrideNotFoundError(id);
    }
    return deleted;
  }

  return {
    listRoutingRules,
    createRoutingRule,
    updateRoutingRule,
    deleteRoutingRule,
    listProviderCorridors,
    createProviderCorridor,
    updateProviderCorridor,
    deleteProviderCorridor,
    listProviderFeeSchedules,
    createProviderFeeSchedule,
    updateProviderFeeSchedule,
    deleteProviderFeeSchedule,
    listProviderLimits,
    createProviderLimit,
    updateProviderLimit,
    deleteProviderLimit,
    listScopeOverrides,
    createScopeOverride,
    updateScopeOverride,
    deleteScopeOverride,
  };
}
