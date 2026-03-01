import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { RouteCandidateNotFoundError } from "../errors";
import type { OrchestrationServiceContext } from "../internal/context";
import { PlanRouteInputSchema, type PlanRouteInput } from "../validation";

export interface RouteCandidate {
  providerCode: string;
  providerCorridorId: string;
  score: number;
  costMinor: bigint;
  fxCostMinor: bigint;
  ruleId: string;
  rulePriority: number;
  supportsWebhooks: boolean;
  pollingRequired: boolean;
  degradationOrder: string[];
}

export interface PlanRouteResult {
  selected: RouteCandidate;
  candidates: RouteCandidate[];
  appliedRuleId: string;
  appliedRuleName: string;
}

function matchesRule(
  input: PlanRouteInput,
  rule: {
    direction: "payin" | "payout" | null;
    corridor: string | null;
    currency: string | null;
    countryFrom: string | null;
    countryTo: string | null;
    amountMinMinor: bigint | null;
    amountMaxMinor: bigint | null;
    riskMin: number | null;
    riskMax: number | null;
  },
) {
  if (rule.direction && rule.direction !== input.direction) return false;
  if (rule.corridor && rule.corridor !== input.corridor) return false;
  if (rule.currency && rule.currency !== input.currency) return false;
  if (rule.countryFrom && rule.countryFrom !== (input.countryFrom ?? null)) {
    return false;
  }
  if (rule.countryTo && rule.countryTo !== (input.countryTo ?? null)) {
    return false;
  }
  if (rule.amountMinMinor != null && input.amountMinor < rule.amountMinMinor) {
    return false;
  }
  if (rule.amountMaxMinor != null && input.amountMinor > rule.amountMaxMinor) {
    return false;
  }
  if (rule.riskMin != null && (input.riskScore ?? 0) < rule.riskMin) {
    return false;
  }
  if (rule.riskMax != null && (input.riskScore ?? 0) > rule.riskMax) {
    return false;
  }
  return true;
}

function includesCountryFilter(ruleValue: string | null, inputValue?: string) {
  if (!ruleValue) {
    return true;
  }
  return ruleValue === (inputValue ?? null);
}

function computeScore(input: {
  amountMinor: bigint;
  fixedFeeMinor: bigint;
  bps: number;
  fxMarkupBps: number;
  slaScore: number;
  healthScore: number;
  weightCost: number;
  weightFx: number;
  weightSla: number;
  weightHealth: number;
}) {
  const variableCostMinor = (input.amountMinor * BigInt(input.bps)) / 10_000n;
  const fxCostMinor = (input.amountMinor * BigInt(input.fxMarkupBps)) / 10_000n;
  const costMinor = input.fixedFeeMinor + variableCostMinor;

  const costPenalty = Number(costMinor / 1_000n) * input.weightCost;
  const fxPenalty = Number(fxCostMinor / 1_000n) * input.weightFx;
  const slaBoost = input.slaScore * input.weightSla;
  const healthBoost = input.healthScore * input.weightHealth;

  return {
    score: slaBoost + healthBoost - costPenalty - fxPenalty,
    costMinor,
    fxCostMinor,
  };
}

export function createPlanRouteHandler(context: OrchestrationServiceContext) {
  const { db } = context;

  return async function planRoute(
    input: PlanRouteInput,
  ): Promise<PlanRouteResult> {
    const validated = PlanRouteInputSchema.parse(input);
    const now = new Date();

    const rules = await db
      .select()
      .from(schema.routingRules)
      .where(eq(schema.routingRules.enabled, true))
      .orderBy(schema.routingRules.priority, schema.routingRules.name);

    const matchingRules = rules.filter((rule) => matchesRule(validated, rule));
    const [selectedRule] = matchingRules;
    if (!selectedRule) {
      throw new RouteCandidateNotFoundError({
        direction: validated.direction,
        corridor: validated.corridor,
        currency: validated.currency,
      });
    }

    const [scopeOverride] = await db
      .select()
      .from(schema.orchestrationScopeOverrides)
      .where(
        and(
          eq(schema.orchestrationScopeOverrides.scopeType, "book"),
          eq(schema.orchestrationScopeOverrides.scopeId, validated.bookId),
          eq(schema.orchestrationScopeOverrides.routingRuleId, selectedRule.id),
        ),
      )
      .limit(1);

    const ruleOverride = scopeOverride?.overrideConfig ?? null;
    const weightCost = Number(
      ruleOverride?.weightCost ?? selectedRule.weightCost,
    );
    const weightFx = Number(ruleOverride?.weightFx ?? selectedRule.weightFx);
    const weightSla = Number(ruleOverride?.weightSla ?? selectedRule.weightSla);
    const weightHealth = Number(
      ruleOverride?.weightHealth ?? selectedRule.weightHealth,
    );
    const preferredProviders = Array.isArray(ruleOverride?.preferredProviders)
      ? (ruleOverride.preferredProviders as string[])
      : (selectedRule.preferredProviders ?? []);

    const corridors = await db
      .select()
      .from(schema.providerCorridors)
      .where(
        and(
          eq(schema.providerCorridors.enabled, true),
          eq(schema.providerCorridors.direction, validated.direction),
          eq(schema.providerCorridors.corridor, validated.corridor),
          eq(schema.providerCorridors.currency, validated.currency),
        ),
      );

    const eligibleCorridors = corridors.filter(
      (corridor) =>
        includesCountryFilter(corridor.countryFrom, validated.countryFrom) &&
        includesCountryFilter(corridor.countryTo, validated.countryTo),
    );
    const providerCodes = eligibleCorridors.map((corridor) => corridor.providerCode);

    const filteredProviderCodes =
      preferredProviders.length > 0
        ? providerCodes.filter((provider) =>
            preferredProviders.includes(provider),
          )
        : providerCodes;

    if (filteredProviderCodes.length === 0) {
      throw new RouteCandidateNotFoundError({
        direction: validated.direction,
        corridor: validated.corridor,
        currency: validated.currency,
      });
    }

    const limits = await db
      .select()
      .from(schema.providerLimits)
      .where(
        and(
          eq(schema.providerLimits.enabled, true),
          eq(schema.providerLimits.corridor, validated.corridor),
          eq(schema.providerLimits.currency, validated.currency),
        ),
      );
    const limitsByProvider = new Map(
      limits.map((limit) => [limit.providerCode, limit]),
    );

    const schedules = await db
      .select()
      .from(schema.providerFeeSchedules)
      .where(
        and(
          eq(schema.providerFeeSchedules.corridor, validated.corridor),
          eq(schema.providerFeeSchedules.currency, validated.currency),
          lte(schema.providerFeeSchedules.effectiveFrom, now),
          or(
            isNull(schema.providerFeeSchedules.effectiveTo),
            gte(schema.providerFeeSchedules.effectiveTo, now),
          ),
        ),
      )
      .orderBy(desc(schema.providerFeeSchedules.effectiveFrom));
    const scheduleByProvider = new Map<string, (typeof schedules)[number]>();
    for (const schedule of schedules) {
      if (!scheduleByProvider.has(schedule.providerCode)) {
        scheduleByProvider.set(schedule.providerCode, schedule);
      }
    }

    const healthRows = await db
      .select()
      .from(schema.connectorHealth)
      .where(eq(schema.connectorHealth.status, "up"));
    const healthByProvider = new Map(
      healthRows.map((row) => [row.providerCode, row]),
    );

    const candidates: RouteCandidate[] = [];
    for (const corridor of eligibleCorridors) {
      if (!filteredProviderCodes.includes(corridor.providerCode)) {
        continue;
      }

      const limit = limitsByProvider.get(corridor.providerCode);
      if (
        limit &&
        (validated.amountMinor < limit.minAmountMinor ||
          validated.amountMinor > limit.maxAmountMinor)
      ) {
        continue;
      }

      const schedule = scheduleByProvider.get(corridor.providerCode);
      const health = healthByProvider.get(corridor.providerCode);
      const scoreDetails = computeScore({
        amountMinor: validated.amountMinor,
        fixedFeeMinor: schedule?.fixedFeeMinor ?? 0n,
        bps: schedule?.bps ?? 0,
        fxMarkupBps: schedule?.fxMarkupBps ?? 0,
        slaScore: corridor.slaScore,
        healthScore: health?.score ?? 50,
        weightCost,
        weightFx,
        weightSla,
        weightHealth,
      });

      candidates.push({
        providerCode: corridor.providerCode,
        providerCorridorId: corridor.id,
        score: scoreDetails.score,
        costMinor: scoreDetails.costMinor,
        fxCostMinor: scoreDetails.fxCostMinor,
        ruleId: selectedRule.id,
        rulePriority: selectedRule.priority,
        supportsWebhooks: corridor.supportsWebhooks,
        pollingRequired: corridor.pollingRequired,
        degradationOrder: selectedRule.degradationOrder ?? [],
      });
    }

    candidates.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.rulePriority !== b.rulePriority) {
        return a.rulePriority - b.rulePriority;
      }
      return a.providerCode.localeCompare(b.providerCode);
    });

    const [selected] = candidates;
    if (!selected) {
      throw new RouteCandidateNotFoundError({
        direction: validated.direction,
        corridor: validated.corridor,
        currency: validated.currency,
      });
    }

    return {
      selected,
      candidates,
      appliedRuleId: selectedRule.id,
      appliedRuleName: selectedRule.name,
    };
  };
}
