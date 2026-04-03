import type { CorrelationContext } from "@bedrock/shared/core/correlation";

import type { BalancePositionDelta } from "./balance-position";
import type { BalanceSubject } from "./balance-subject";

interface BalanceEventRequestContextInput {
  requestId?: string | null | undefined;
  correlationId?: string | null | undefined;
  traceId?: string | null | undefined;
  causationId?: string | null | undefined;
}

export interface BalanceEventInput extends BalancePositionDelta {
  subject: BalanceSubject;
  eventType: string;
  version?: number;
  holdRef?: string | null;
  operationId?: string | null;
  actorId?: string | null;
  requestContext?: CorrelationContext;
  meta?: Record<string, unknown> | null;
}

export function normalizeBalanceEventRequestContext(
  input: BalanceEventRequestContextInput | undefined,
): CorrelationContext | undefined {
  if (!input) {
    return undefined;
  }

  return {
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
    causationId: input.causationId ?? null,
  };
}
