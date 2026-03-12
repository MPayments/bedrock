import { z } from "zod";

import type { Document } from "@bedrock/app/documents/schema";

import { toMinorAmountString } from "../../ledger/amount-utils";

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

function normalizeAmountValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("amount must be a finite number");
    }
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  throw new Error("amount must be a string, number, or bigint");
}

// This parser only accepts a simple optional sign + digits + optional fraction.
// eslint-disable-next-line security/detect-unsafe-regex
const amountInputPattern = /^(-?)(\d+)(?:\.(\d+))?$/;

export const amountValueSchema = z.union([z.string(), z.number(), z.bigint()]).transform(
  (value, ctx) => {
    const normalized = normalizeAmountValue(value).replace(",", ".");
    const match = amountInputPattern.exec(normalized);
    if (!match) {
      ctx.addIssue({
        code: "custom",
        message: "amount must be a number, e.g. 1000.50",
      });
      return z.NEVER;
    }

    const [, signRaw = "", integerRaw = "", fractionRaw = ""] = match;
    const integerPart = integerRaw.replace(/^0+(?=\d)/, "");
    const fractionPart = fractionRaw.replace(/0+$/, "");
    const isZero = /^0+$/.test(integerPart) && fractionPart.length === 0;

    if (fractionPart.length === 0) {
      return isZero ? "0" : `${signRaw}${integerPart}`;
    }

    return `${signRaw}${integerPart}.${fractionPart}`;
  },
);

export { toMinorAmountString };

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
