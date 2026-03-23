import type { z } from "zod";

import type {
  DocumentSnapshot,
  DocumentSummaryFields,
} from "@bedrock/documents";

export function serializeOccurredAt<T extends { occurredAt: Date }>(
  payload: T,
) {
  return {
    ...payload,
    occurredAt: payload.occurredAt.toISOString(),
  };
}

export function parseDocumentPayload<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  document: Pick<DocumentSnapshot, "payload" | "occurredAt">,
): z.infer<TSchema> {
  return schema.parse({
    ...document.payload,
    occurredAt: document.occurredAt,
  });
}

export function buildDocumentDraft<
  TInput extends { occurredAt: Date },
  TPayload extends Record<string, unknown>,
>(input: TInput, payload: TPayload, summary: DocumentSummaryFields) {
  return {
    occurredAt: input.occurredAt,
    payload,
    summary,
  };
}

export function buildDocumentPostIdempotencyKey(
  document: Pick<DocumentSnapshot, "id" | "payloadVersion">,
) {
  return `doc:${document.id}:post:v${document.payloadVersion}`;
}
