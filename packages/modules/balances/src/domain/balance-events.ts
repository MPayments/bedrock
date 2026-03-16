import type { CorrelationContext } from "@bedrock/shared/core/correlation";

import type { BalancePositionDelta } from "./balance-position";
import type { BalanceSubject } from "./balance-subject";

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
