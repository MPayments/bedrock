import { z } from "zod";

import { OPERATION_TRANSFER_TYPE } from "./types";

const uuidSchema = z.uuid({ version: "v4" });

const bookIdSchema = uuidSchema;
const idempotencyKeySchema = z.string().min(1).max(255);
const sourceTypeSchema = z.string().min(1).max(100);
const sourceIdSchema = z.string().min(1).max(255);
const memoSchema = z.string().max(1000).optional().nullable();

const currencySchema = z
  .string()
  .transform((val) => val.trim().toUpperCase())
  .refine((val) => /^[A-Z0-9_]{2,16}$/.test(val), {
    message:
      "Currency must be 2-16 uppercase alphanumeric characters or underscores",
  });

const planRefSchema = z.string().min(1).max(512);
const accountNoSchema = z
  .string()
  .trim()
  .min(1, "accountNo must be a non-empty string")
  .max(128, "accountNo must be at most 128 characters");
const positiveAmountSchema = z.bigint().positive();
const nonNegativeAmountSchema = z.bigint().min(0n);
const positiveTimeoutSchema = z.number().int().positive();
const transferCodeSchema = z.number().int().min(0).optional();
const chainIdSchema = z.string().min(1).optional().nullable();

const dimensionsSchema = z.record(z.string().min(1), z.string().min(1));

const contextSchema = z
  .record(z.string().min(1), z.string())
  .optional()
  .nullable();

const accountSideSchema = z.object({
  accountNo: accountNoSchema,
  currency: currencySchema,
  dimensions: dimensionsSchema,
});

const pendingConfigSchema = z
  .object({
    timeoutSeconds: positiveTimeoutSchema,
    ref: z.string().min(1).max(255).optional().nullable(),
  })
  .optional();

const baseIntentLineSchema = z.object({
  planRef: planRefSchema,
  code: transferCodeSchema,
  chain: chainIdSchema,
  memo: memoSchema,
});

const createIntentLineSchema = baseIntentLineSchema.extend({
  type: z.literal(OPERATION_TRANSFER_TYPE.CREATE),
  bookId: bookIdSchema,
  postingCode: z.string().min(1).max(128),
  debit: accountSideSchema,
  credit: accountSideSchema,
  amountMinor: positiveAmountSchema,
  pending: pendingConfigSchema,
  context: contextSchema,
});

const postPendingIntentLineSchema = baseIntentLineSchema.extend({
  type: z.literal(OPERATION_TRANSFER_TYPE.POST_PENDING),
  currency: currencySchema,
  pendingId: z.bigint().positive(),
  amount: nonNegativeAmountSchema.optional(),
});

const voidPendingIntentLineSchema = baseIntentLineSchema.extend({
  type: z.literal(OPERATION_TRANSFER_TYPE.VOID_PENDING),
  currency: currencySchema,
  pendingId: z.bigint().positive(),
});

const intentLineSchema = z.discriminatedUnion("type", [
  createIntentLineSchema,
  postPendingIntentLineSchema,
  voidPendingIntentLineSchema,
]);

const sourceSchema = z.object({
  type: sourceTypeSchema,
  id: sourceIdSchema,
});

export const operationIntentSchema = z.object({
  source: sourceSchema,
  operationCode: z.string().min(1).max(128),
  operationVersion: z.number().int().positive().default(1),
  payload: z.unknown().optional(),
  idempotencyKey: idempotencyKeySchema,
  postingDate: z.date(),
  lines: z.array(intentLineSchema).min(1, "lines must be a non-empty array"),
});

type ValidatedOperationIntent = z.infer<typeof operationIntentSchema>;
type ValidatedIntentLine = z.infer<typeof intentLineSchema>;

export function validateOperationIntent(
  input: unknown,
): ValidatedOperationIntent {
  return operationIntentSchema.parse(input);
}

export function validateChainBlocks(lines: ValidatedIntentLine[]): void {
  const pos = new Map<string, number[]>();

  for (let i = 0; i < lines.length; i++) {
    const ch = lines[i]!.chain;
    if (!ch) continue;

    const arr = pos.get(ch) ?? [];
    arr.push(i);
    pos.set(ch, arr);
  }

  for (const [ch, arr] of pos) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i]! !== arr[i - 1]! + 1) {
        throw new Error(
          `Non-contiguous chain block detected for chain="${ch}". ` +
            "Chain entries must be adjacent in lines[] to be safe with TB linked semantics.",
        );
      }
    }
  }
}
