import type { z } from "zod";

export function nowDateTimeLocal() {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function isoToDateTimeLocal(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return nowDateTimeLocal();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return nowDateTimeLocal();
  }

  const offsetMinutes = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function readString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return "";
}

export function optionalString(value: unknown): string | undefined {
  const normalized = readString(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function toOccurredAtIso(value: unknown): string {
  const normalized = readString(value).trim();
  if (normalized.length === 0) {
    return new Date().toISOString();
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

export function parseSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.input<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw result.error;
  }

  return input as z.input<TSchema>;
}

export const RUSSIAN_MAJOR_AMOUNT_MESSAGES = {
  invalidNumberMessage: "Сумма должна быть числом, например 1000.50",
  tooManyFractionDigitsMessage: (input: {
    currency: string;
    precision: number;
  }) =>
    `Слишком много знаков после запятой для ${
      input.currency.length > 0 ? input.currency : "выбранной валюты"
    }: максимум ${input.precision}`,
};
