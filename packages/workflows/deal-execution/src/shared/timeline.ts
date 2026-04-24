import { randomUUID } from "node:crypto";

import type { ExecutionLifecycleEventType } from "./deps";

export function buildTimelineEvent(input: {
  actorUserId: string;
  dealId: string;
  payload: Record<string, unknown>;
  sourceRef: string;
  type: ExecutionLifecycleEventType;
}) {
  return {
    actorLabel: null,
    actorUserId: input.actorUserId,
    dealId: input.dealId,
    id: randomUUID(),
    occurredAt: new Date(),
    payload: input.payload,
    sourceRef: input.sourceRef,
    type: input.type,
    visibility: "internal" as const,
  };
}
