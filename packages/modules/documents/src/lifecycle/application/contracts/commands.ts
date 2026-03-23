import { z } from "zod";

import type { CorrelationContext } from "@bedrock/shared/core/correlation";

export type DocumentRequestContext = CorrelationContext;

export type DocumentTransitionAction =
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "cancel"
  | "repost";

export interface DocumentTransitionInput {
  action: DocumentTransitionAction;
  docType: string;
  documentId: string;
  actorUserId: string;
  idempotencyKey?: string;
  requestContext?: DocumentRequestContext;
}

export const DocumentRequestContextSchema = z.object({
  requestId: z.string().trim().min(1).nullable().optional(),
  correlationId: z.string().trim().min(1).nullable().optional(),
  traceId: z.string().trim().min(1).nullable().optional(),
  causationId: z.string().trim().min(1).nullable().optional(),
  actorId: z.string().trim().min(1).nullable().optional(),
});
