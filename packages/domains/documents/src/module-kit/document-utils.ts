import { z } from "zod";

import type { Document } from "@multihansa/documents/schema";

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

function parseNormalizedAmount(normalized: string) {
  const signRaw = normalized.startsWith("-") ? "-" : "";
  const unsigned = signRaw ? normalized.slice(1) : normalized;
  const [integerRaw = "", fractionRaw = "", ...rest] = unsigned.split(".");

  if (
    rest.length > 0 ||
    integerRaw.length === 0 ||
    !/^\d+$/.test(integerRaw) ||
    (fractionRaw.length > 0 && !/^\d+$/.test(fractionRaw))
  ) {
    return null;
  }

  return { signRaw, integerRaw, fractionRaw };
}

export const amountValueSchema = z.union([z.string(), z.number(), z.bigint()]).transform(
  (value, ctx) => {
    const normalized = normalizeAmountValue(value).replace(",", ".");
    const parsed = parseNormalizedAmount(normalized);
    if (!parsed) {
      ctx.addIssue({
        code: "custom",
        message: "amount must be a number, e.g. 1000.50",
      });
      return z.NEVER;
    }

    const { signRaw, integerRaw, fractionRaw } = parsed;
    const integerPart = integerRaw.replace(/^0+(?=\d)/, "");
    const fractionPart = fractionRaw.replace(/0+$/, "");
    const isZero = /^0+$/.test(integerPart) && fractionPart.length === 0;

    if (fractionPart.length === 0) {
      return isZero ? "0" : `${signRaw}${integerPart}`;
    }

    return `${signRaw}${integerPart}.${fractionPart}`;
  },
);

function resolveCurrencyPrecision(currencyCode: unknown): number {
  if (typeof currencyCode !== "string") {
    return 2;
  }

  const normalized = currencyCode.trim().toUpperCase();
  if (normalized.length === 0) {
    return 2;
  }

  try {
    const options = new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    }).resolvedOptions();
    return Math.max(0, Math.trunc(options.maximumFractionDigits ?? 2));
  } catch {
    return 2;
  }
}

export function toMinorAmountString(
  amountValue: unknown,
  currencyCode: unknown,
  options?: { requirePositive?: boolean },
): string {
  const normalized = normalizeAmountValue(amountValue).replace(",", ".");
  const parsed = parseNormalizedAmount(normalized);
  if (!parsed) {
    throw new Error("amount must be a number, e.g. 1000.50");
  }

  const { signRaw, integerRaw, fractionRaw } = parsed;
  const precision = resolveCurrencyPrecision(currencyCode);
  if (fractionRaw.length > precision) {
    const currency =
      typeof currencyCode === "string" ? currencyCode.trim().toUpperCase() : "";
    throw new Error(
      `amount has too many fraction digits for ${
        currency.length > 0 ? currency : "selected currency"
      }: max ${precision}`,
    );
  }

  const fractionPart = fractionRaw.padEnd(precision, "0");
  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
  const minorDigits = `${normalizedInteger}${fractionPart}`.replace(
    /^0+(?=\d)/,
    "",
  );
  let minorAmount = BigInt(minorDigits.length > 0 ? minorDigits : "0");

  if (signRaw === "-" && minorAmount !== 0n) {
    minorAmount = -minorAmount;
  }

  if (options?.requirePositive && minorAmount <= 0n) {
    throw new Error("amount must be positive");
  }

  return minorAmount.toString();
}

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
