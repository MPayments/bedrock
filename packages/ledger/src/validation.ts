import { z } from "zod";

import { PlanType } from "./types";

const uuidSchema = z.uuid({ version: "v4" });

export const orgIdSchema = uuidSchema;
export const idempotencyKeySchema = z.string().min(1).max(255);
export const sourceTypeSchema = z.string().min(1).max(100);
export const sourceIdSchema = z.string().min(1).max(255);
export const memoSchema = z.string().max(1000).optional().nullable();

export const currencySchema = z
  .string()
  .transform((val) => val.trim().toUpperCase())
  .refine((val) => /^[A-Z0-9_]{2,16}$/.test(val), {
    message:
      "Currency must be 2-16 uppercase alphanumeric characters or underscores",
  });

export const planRefSchema = z.string().min(1).max(512);
export const accountNoSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{2}(\.[0-9]{2})?$/, "accountNo must match NN or NN.NN");
export const positiveAmountSchema = z.bigint().positive();
export const nonNegativeAmountSchema = z.bigint().min(0n);
export const positiveTimeoutSchema = z.number().int().positive();
export const transferCodeSchema = z.number().int().min(0).optional();
export const chainIdSchema = z.string().min(1).optional().nullable();

export const postingAnalyticsSchema = z
  .object({
    counterpartyId: uuidSchema.optional().nullable(),
    customerId: uuidSchema.optional().nullable(),
    orderId: uuidSchema.optional().nullable(),
    operationalAccountId: uuidSchema.optional().nullable(),
    transferId: uuidSchema.optional().nullable(),
    quoteId: uuidSchema.optional().nullable(),
    feeBucket: z.string().max(128).optional().nullable(),
  })
  .optional();

export const pendingConfigSchema = z
  .object({
    timeoutSeconds: positiveTimeoutSchema,
    ref: z.string().min(1).max(255).optional().nullable(),
  })
  .optional();

const baseTransferPlanSchema = z.object({
  planRef: planRefSchema,
  currency: currencySchema,
  code: transferCodeSchema,
  chain: chainIdSchema,
  memo: memoSchema,
});

export const createTransferPlanSchema = baseTransferPlanSchema.extend({
  type: z.literal(PlanType.CREATE),
  bookOrgId: orgIdSchema,
  postingCode: z.string().min(1).max(128),
  debitAccountNo: accountNoSchema,
  creditAccountNo: accountNoSchema,
  amount: positiveAmountSchema,
  pending: pendingConfigSchema,
  analytics: postingAnalyticsSchema,
});

export const postPendingTransferPlanSchema = baseTransferPlanSchema.extend({
  type: z.literal(PlanType.POST_PENDING),
  pendingId: z.bigint().positive(),
  amount: nonNegativeAmountSchema.optional(),
});

export const voidPendingTransferPlanSchema = baseTransferPlanSchema.extend({
  type: z.literal(PlanType.VOID_PENDING),
  pendingId: z.bigint().positive(),
});

export const transferPlanSchema = z.discriminatedUnion("type", [
  createTransferPlanSchema,
  postPendingTransferPlanSchema,
  voidPendingTransferPlanSchema,
]);

export const sourceSchema = z.object({
  type: sourceTypeSchema,
  id: sourceIdSchema,
});

export const createOperationInputSchema = z.object({
  source: sourceSchema,
  operationCode: z.string().min(1).max(128),
  operationVersion: z.number().int().positive().default(1),
  payload: z.unknown().optional(),
  idempotencyKey: idempotencyKeySchema,
  postingDate: z.date(),
  transfers: z.array(transferPlanSchema).min(1, "transfers must be a non-empty array"),
});

export type ValidatedCreateOperationInput = z.infer<typeof createOperationInputSchema>;
export type ValidatedTransferPlan = z.infer<typeof transferPlanSchema>;

export function validateCreateOperationInput(
  input: unknown,
): ValidatedCreateOperationInput {
  return createOperationInputSchema.parse(input);
}

export function validateChainBlocks(transfers: ValidatedTransferPlan[]): void {
  const pos = new Map<string, number[]>();

  for (let i = 0; i < transfers.length; i++) {
    const ch = transfers[i]!.chain;
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
            "Chain entries must be adjacent in transfers[] to be safe with TB linked semantics.",
        );
      }
    }
  }
}
