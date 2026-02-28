import { z } from "zod";

import type { Document } from "@bedrock/db/schema";

export const amountMinorSchema = z
  .union([z.string(), z.number().int(), z.bigint()])
  .transform((value, ctx) => {
    try {
      const parsed = typeof value === "bigint" ? value : BigInt(value);
      if (parsed <= 0n) {
        ctx.addIssue({
          code: "custom",
          message: "amountMinor must be positive",
        });
        return z.NEVER;
      }

      return parsed.toString();
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "amountMinor must be an integer in minor units",
      });
      return z.NEVER;
    }
  });

export function serializeOccurredAt<T extends { occurredAt: Date }>(payload: T) {
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
