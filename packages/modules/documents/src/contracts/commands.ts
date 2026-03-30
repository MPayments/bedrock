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

export const CreateDocumentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  dealId: z.uuid().optional(),
  input: z.unknown(),
});

export const UpdateDocumentInputSchema = z.object({
  input: z.unknown(),
});

export interface DocumentTransitionInput {
  action: DocumentTransitionAction;
  docType: string;
  documentId: string;
  actorUserId: string;
  idempotencyKey?: string;
  requestContext?: DocumentRequestContext;
}
