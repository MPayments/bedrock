import { z } from "zod";

import { OPERATION_TRANSFER_TYPE } from "../domain/operation-intent";

export const LedgerOperationStatusSchema = z.enum(["pending", "posted", "failed"]);
export const SortableLedgerOperationColumnSchema = z.enum([
  "createdAt",
  "postingDate",
  "postedAt",
]);
export const DimensionsSchema = z.record(
  z.string().min(1),
  z.string().min(1),
);

const uuidSchema = z.uuid({ version: "v4" });
const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema).min(1);
const idempotencyKeySchema = z.string().min(1).max(255);
const sourceTypeSchema = z.string().min(1).max(100);
const sourceIdSchema = z.string().min(1).max(255);
const memoSchema = z.string().max(1000).optional().nullable();

const currencySchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => /^[A-Z0-9_]{2,16}$/.test(value), {
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

const contextSchema = z
  .record(z.string().min(1), z.string())
  .optional()
  .nullable();

const accountSideSchema = z.object({
  accountNo: accountNoSchema,
  currency: currencySchema,
  dimensions: DimensionsSchema,
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
  bookId: uuidSchema,
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

export const IntentLineSchema = z.discriminatedUnion("type", [
  createIntentLineSchema,
  postPendingIntentLineSchema,
  voidPendingIntentLineSchema,
]);

export const OperationIntentSchema = z.object({
  source: z.object({
    type: sourceTypeSchema,
    id: sourceIdSchema,
  }),
  operationCode: z.string().min(1).max(128),
  operationVersion: z.number().int().positive().default(1),
  payload: z.unknown().optional(),
  idempotencyKey: idempotencyKeySchema,
  postingDate: z.date(),
  lines: z.array(IntentLineSchema).min(1, "lines must be a non-empty array"),
});

export const ListLedgerOperationsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: SortableLedgerOperationColumnSchema.default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  query: nonEmptyStringSchema.optional(),
  status: z.array(LedgerOperationStatusSchema).min(1).optional(),
  operationCode: nonEmptyStringArraySchema.optional(),
  sourceType: nonEmptyStringArraySchema.optional(),
  sourceId: nonEmptyStringSchema.optional(),
  bookId: nonEmptyStringSchema.optional(),
  dimensionFilters: z
    .record(nonEmptyStringSchema, nonEmptyStringArraySchema)
    .optional(),
});
