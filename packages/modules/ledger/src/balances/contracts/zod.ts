import { z } from "zod";

import { toMinorAmountString } from "@bedrock/shared/money";

export const BalanceHoldStateSchema = z.enum(["active", "released", "consumed"]);

export const BalanceSubjectSchema = z.object({
  bookId: z.uuid(),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  currency: z.string().min(1),
});

const ReserveBalanceInputRawSchema = z
  .object({
    subject: BalanceSubjectSchema,
    amount: z.union([z.string(), z.number(), z.bigint()]).optional(),
    amountMinor: z.bigint().positive().optional(),
    holdRef: z.string().min(1),
    reason: z.string().min(1).optional(),
    actorId: z.string().min(1).optional(),
    idempotencyKey: z.string().min(1).max(255),
    requestContext: z
      .object({
        requestId: z.string().min(1).optional().nullable(),
        correlationId: z.string().min(1).optional().nullable(),
        traceId: z.string().min(1).optional().nullable(),
        causationId: z.string().min(1).optional().nullable(),
      })
      .optional(),
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
  idempotencyKey: z.string().min(1).max(255),
  requestContext: z
    .object({
      requestId: z.string().min(1).optional().nullable(),
      correlationId: z.string().min(1).optional().nullable(),
      traceId: z.string().min(1).optional().nullable(),
      causationId: z.string().min(1).optional().nullable(),
    })
    .optional(),
});

export const ConsumeBalanceInputSchema = z.object({
  subject: BalanceSubjectSchema,
  holdRef: z.string().min(1),
  reason: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(255),
  requestContext: z
    .object({
      requestId: z.string().min(1).optional().nullable(),
      correlationId: z.string().min(1).optional().nullable(),
      traceId: z.string().min(1).optional().nullable(),
      causationId: z.string().min(1).optional().nullable(),
    })
    .optional(),
});

export const ListOrganizationLiquidityRowsInputSchema = z.object({
  resolvedBookIds: z.array(z.string().min(1)),
  resolvedCounterpartyIds: z.array(z.string().min(1)),
  scopeType: z.enum(["all", "counterparty", "group", "book"]),
  attributionMode: z.enum(["analytic_counterparty", "book_org"]),
  internalLedgerOrganizationIds: z.array(z.string().min(1)),
  currency: z.string().min(1).optional(),
});

export const ListOrganizationRequisiteLiquidityRowsInputSchema = z.object({
  organizationIds: z.array(z.string().min(1)),
  currency: z.string().min(1).optional(),
});
