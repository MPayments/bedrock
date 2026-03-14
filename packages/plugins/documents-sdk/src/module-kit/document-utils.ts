import type { z } from "zod";

import type { Document } from "@bedrock/documents/plugins";

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
  document: Pick<Document, "payload" | "occurredAt">,
): z.infer<TSchema> {
  return schema.parse({
    ...document.payload,
    occurredAt: document.occurredAt,
  });
}

export function buildDocumentDraft<
  TInput extends { occurredAt: Date },
  TPayload,
>(input: TInput, payload: TPayload) {
  return {
    occurredAt: input.occurredAt,
    payload,
  };
}

export function buildDocumentPostIdempotencyKey(
  document: Pick<Document, "id" | "payloadVersion">,
) {
  return `doc:${document.id}:post:v${document.payloadVersion}`;
}
