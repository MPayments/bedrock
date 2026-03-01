import { and, eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

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
    const [row] = await context.db
      .select()
      .from(schema.connectorHealth)
      .where(eq(schema.connectorHealth.providerCode, input.providerCode))
      .limit(1);

    const currentScore = row?.score ?? 50;
    const nextScore =
      input.status === "succeeded"
        ? Math.min(100, currentScore + 5)
        : input.status === "failed_terminal"
          ? Math.max(0, currentScore - 20)
          : Math.max(0, currentScore - 5);

    const [updated] = await context.db
      .insert(schema.connectorHealth)
      .values({
        providerCode: input.providerCode,
        status: input.status === "succeeded" ? "up" : "degraded",
        score: nextScore,
        successCount: input.status === "succeeded" ? 1 : 0,
        failureCount: input.status !== "succeeded" ? 1 : 0,
        lastCheckedAt: new Date(),
        lastSuccessAt: input.status === "succeeded" ? new Date() : null,
        lastFailureAt: input.status !== "succeeded" ? new Date() : null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: schema.connectorHealth.providerCode,
        set: {
          status: input.status === "succeeded" ? "up" : "degraded",
          score: nextScore,
          successCount:
            input.status === "succeeded"
              ? row
                ? row.successCount + 1
                : 1
              : (row?.successCount ?? 0),
          failureCount:
            input.status !== "succeeded"
              ? row
                ? row.failureCount + 1
                : 1
              : (row?.failureCount ?? 0),
          lastCheckedAt: new Date(),
          lastSuccessAt:
            input.status === "succeeded" ? new Date() : row?.lastSuccessAt,
          lastFailureAt:
            input.status !== "succeeded" ? new Date() : row?.lastFailureAt,
          updatedAt: new Date(),
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
