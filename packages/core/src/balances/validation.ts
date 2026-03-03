import { z } from "zod";

export const BalanceSubjectSchema = z.object({
  bookId: z.uuid(),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  currency: z.string().min(1),
});

function resolveCurrencyPrecision(currencyCode: string): number {
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

function toMinorAmountString(amountValue: unknown, currencyCode: string): string {
  let normalizedAmount: string;

  if (typeof amountValue === "bigint") {
    normalizedAmount = amountValue.toString();
  } else if (typeof amountValue === "number") {
    if (!Number.isFinite(amountValue)) {
      throw new Error("amount must be a finite number");
    }
    normalizedAmount = String(amountValue);
  } else if (typeof amountValue === "string") {
    normalizedAmount = amountValue.trim().replace(",", ".");
  } else {
    throw new Error("amount must be a string, number, or bigint");
  }

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(normalizedAmount);
  if (!match) {
    throw new Error("amount must be a number, e.g. 1000.50");
  }

  const [, signRaw = "", integerRaw = "", fractionRaw = ""] = match;
  const precision = resolveCurrencyPrecision(currencyCode);

  if (fractionRaw.length > precision) {
    throw new Error(
      `amount has too many fraction digits for ${currencyCode.toUpperCase()}: max ${precision}`,
    );
  }

  const fractionPart = fractionRaw.padEnd(precision, "0");
  const normalizedInteger = integerRaw.replace(/^0+(?=\d)/, "");
  const minorDigits = `${normalizedInteger}${fractionPart}`.replace(/^0+(?=\d)/, "");
  let minorAmount = BigInt(minorDigits.length > 0 ? minorDigits : "0");

  if (signRaw === "-" && minorAmount !== 0n) {
    minorAmount = -minorAmount;
  }

  return minorAmount.toString();
}

const ReserveBalanceInputRawSchema = z
  .object({
    subject: BalanceSubjectSchema,
    amount: z.union([z.string(), z.number(), z.bigint()]).optional(),
    amountMinor: z.bigint().positive().optional(),
    holdRef: z.string().min(1),
    reason: z.string().min(1).optional(),
    actorId: z.string().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.amount === undefined && input.amountMinor === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "amount is required",
        path: ["amount"],
      });
    }

    if (input.amount !== undefined && input.amountMinor !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either amount or amountMinor, not both",
      });
    }
  });

export const ReserveBalanceInputSchema = ReserveBalanceInputRawSchema.transform(
  (input, ctx) => {
    if (typeof input.amountMinor === "bigint") {
      const { amount: _amount, amountMinor, ...rest } = input;
      return {
        ...rest,
        amountMinor,
      };
    }

    try {
      const minorAmount = BigInt(
        toMinorAmountString(input.amount, input.subject.currency),
      );
      if (minorAmount <= 0n) {
        ctx.addIssue({
          code: "custom",
          message: "amount must be positive",
          path: ["amount"],
        });
        return z.NEVER;
      }

      const { amount: _amount, amountMinor: _amountMinor, ...rest } = input;
      return {
        ...rest,
        amountMinor: minorAmount,
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "amount is invalid",
        path: ["amount"],
      });
      return z.NEVER;
    }
  },
);

export const ReleaseBalanceInputSchema = z.object({
  subject: BalanceSubjectSchema,
  holdRef: z.string().min(1),
  reason: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

export const ConsumeBalanceInputSchema = z.object({
  subject: BalanceSubjectSchema,
  holdRef: z.string().min(1),
  reason: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

export type BalanceSubjectInput = z.infer<typeof BalanceSubjectSchema>;
export type ReserveBalanceInput = z.infer<typeof ReserveBalanceInputSchema>;
export type ReleaseBalanceInput = z.infer<typeof ReleaseBalanceInputSchema>;
export type ConsumeBalanceInput = z.infer<typeof ConsumeBalanceInputSchema>;

export function validateBalanceSubject(input: unknown): BalanceSubjectInput {
  return BalanceSubjectSchema.parse(input);
}

export function validateReserveBalanceInput(input: unknown): ReserveBalanceInput {
  return ReserveBalanceInputSchema.parse(input);
}

export function validateReleaseBalanceInput(input: unknown): ReleaseBalanceInput {
  return ReleaseBalanceInputSchema.parse(input);
}

export function validateConsumeBalanceInput(input: unknown): ConsumeBalanceInput {
  return ConsumeBalanceInputSchema.parse(input);
}
