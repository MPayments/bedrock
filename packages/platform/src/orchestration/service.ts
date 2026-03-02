import { and, eq, sql } from "drizzle-orm";

import { schema as connectorsSchema } from "@bedrock/db/schema/connectors";
import { schema as orchestrationSchema } from "@bedrock/db/schema/orchestration";

import {
  createConfigHandlers,
  type OrchestrationConfigHandlers,
} from "./commands/config";
import type { PlanRouteResult } from "./commands/route";
import { createPlanRouteHandler } from "./commands/route";
import { RouteCandidateNotFoundError } from "./errors";
import {
  createOrchestrationServiceContext,
  type OrchestrationServiceContext,
  type OrchestrationServiceDeps,
} from "./internal/context";
import { type PlanRouteInput } from "./validation";

const schema = {
  ...orchestrationSchema,
  ...connectorsSchema,
};

export interface OrchestrationService extends OrchestrationConfigHandlers {
  planRoute: (input: PlanRouteInput) => Promise<PlanRouteResult>;
  simulateRoute: (input: PlanRouteInput) => Promise<PlanRouteResult>;
  selectNextProviderForIntent: (input: {
    intentId: string;
    bookId: string;
    riskScore?: number;
    countryFrom?: string;
    countryTo?: string;
  }) => Promise<PlanRouteResult>;
  resolveOverride: (input: {
    scopeType: "book";
    scopeId: string;
    routingRuleId: string;
  }) => Promise<unknown | null>;
  recordAttemptOutcome: (input: {
    providerCode: string;
    status: "succeeded" | "failed_retryable" | "failed_terminal";
  }) => Promise<unknown>;
}

export function createOrchestrationService(
  deps: OrchestrationServiceDeps,
): OrchestrationService {
  const context = createOrchestrationServiceContext(deps);
  const planRoute = createPlanRouteHandler(context);
  const config = createConfigHandlers(context);

  async function selectNextProviderForIntent(input: {
    intentId: string;
    bookId: string;
    riskScore?: number;
    countryFrom?: string;
    countryTo?: string;
  }) {
    const [intent] = await context.db
      .select()
      .from(schema.connectorPaymentIntents)
      .where(eq(schema.connectorPaymentIntents.id, input.intentId))
      .limit(1);

    if (!intent) {
      throw new RouteCandidateNotFoundError({
        direction: "payout",
        corridor: "unknown",
        currency: "unknown",
      });
    }

    const planned = await planRoute({
      intentId: intent.id,
      direction: intent.direction,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      corridor: intent.corridor ?? "default",
      countryFrom: input.countryFrom,
      countryTo: input.countryTo,
      riskScore: input.riskScore,
      bookId: input.bookId,
    });

    const attempts = await context.db
      .select({
        providerCode: schema.paymentAttempts.providerCode,
      })
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.intentId, intent.id));
    const alreadyTried = new Set(
      attempts.map((attempt) => attempt.providerCode),
    );

    const candidate =
      planned.candidates.find((item) => !alreadyTried.has(item.providerCode)) ??
      planned.selected;

    return {
      ...planned,
      selected: candidate,
    };
  }

  async function resolveOverride(input: {
    scopeType: "book";
    scopeId: string;
    routingRuleId: string;
  }) {
    const [override] = await context.db
      .select()
      .from(schema.orchestrationScopeOverrides)
      .where(
        and(
          eq(schema.orchestrationScopeOverrides.scopeType, input.scopeType),
          eq(schema.orchestrationScopeOverrides.scopeId, input.scopeId),
          eq(
            schema.orchestrationScopeOverrides.routingRuleId,
            input.routingRuleId,
          ),
        ),
      )
      .limit(1);

    return override ?? null;
  }

  async function recordAttemptOutcome(input: {
    providerCode: string;
    status: "succeeded" | "failed_retryable" | "failed_terminal";
  }) {
    const isSuccess = input.status === "succeeded";
    const scoreDelta =
      input.status === "succeeded"
        ? 5
        : input.status === "failed_terminal"
          ? -20
          : -5;
    const now = new Date();
    const healthStatus = isSuccess ? "up" : "degraded";

    const [updated] = await context.db
      .insert(schema.connectorHealth)
      .values({
        providerCode: input.providerCode,
        status: healthStatus,
        score: Math.max(0, Math.min(100, 50 + scoreDelta)),
        successCount: isSuccess ? 1 : 0,
        failureCount: isSuccess ? 0 : 1,
        lastCheckedAt: now,
        lastSuccessAt: isSuccess ? now : null,
        lastFailureAt: isSuccess ? null : now,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: schema.connectorHealth.providerCode,
        set: {
          status: healthStatus,
          score: sql`LEAST(100, GREATEST(0, ${schema.connectorHealth.score} + ${scoreDelta}))`,
          successCount: isSuccess
            ? sql`${schema.connectorHealth.successCount} + 1`
            : schema.connectorHealth.successCount,
          failureCount: isSuccess
            ? schema.connectorHealth.failureCount
            : sql`${schema.connectorHealth.failureCount} + 1`,
          lastCheckedAt: now,
          lastSuccessAt: isSuccess ? now : schema.connectorHealth.lastSuccessAt,
          lastFailureAt: isSuccess ? schema.connectorHealth.lastFailureAt : now,
          updatedAt: now,
        },
      })
      .returning();

    return updated!;
  }

  async function simulateRoute(input: PlanRouteInput) {
    return planRoute(input);
  }

  return {
    planRoute,
    simulateRoute,
    selectNextProviderForIntent,
    recordAttemptOutcome,
    resolveOverride,
    ...config,
  };
}

export type { OrchestrationServiceContext, OrchestrationServiceDeps };
