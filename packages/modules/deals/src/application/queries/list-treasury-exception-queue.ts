import { z } from "zod";

import type { DealReads } from "../ports/deal.reads";

export const TREASURY_EXCEPTION_QUEUE_ROW_KIND_VALUES = [
  "ready_leg",
  "blocked_leg",
  "failed_instruction",
  "pre_funded_awaiting_collection",
  "intercompany_imbalance",
  "reconciliation_mismatch",
] as const;

export const TreasuryExceptionQueueRowKindSchema = z.enum(
  TREASURY_EXCEPTION_QUEUE_ROW_KIND_VALUES,
);

export type TreasuryExceptionQueueRowKind = z.infer<
  typeof TreasuryExceptionQueueRowKindSchema
>;

export const TreasuryExceptionQueueRowSchema = z.object({
  ageSeconds: z.number().int().nonnegative(),
  amountMinor: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  currencyCode: z.string().nullable(),
  currencyId: z.uuid().nullable(),
  dealId: z.uuid().nullable(),
  dealRef: z.string().nullable(),
  instructionId: z.uuid().nullable(),
  kind: TreasuryExceptionQueueRowKindSchema,
  legIdx: z.number().int().positive().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  triggeredAt: z.date(),
});

export type TreasuryExceptionQueueRow = z.infer<
  typeof TreasuryExceptionQueueRowSchema
>;

export const ListTreasuryExceptionQueueInputSchema = z.object({
  currencyCode: z.string().optional(),
  dealId: z.uuid().optional(),
  internalEntityOrganizationId: z.uuid().optional(),
  kind: TreasuryExceptionQueueRowKindSchema.optional(),
  limit: z.number().int().positive().max(500).default(100),
});

export type ListTreasuryExceptionQueueInput = z.infer<
  typeof ListTreasuryExceptionQueueInputSchema
>;

export class ListTreasuryExceptionQueueQuery {
  constructor(private readonly reads: DealReads) {}

  async execute(
    raw: ListTreasuryExceptionQueueInput,
  ): Promise<TreasuryExceptionQueueRow[]> {
    const validated = ListTreasuryExceptionQueueInputSchema.parse(raw);

    if (!this.reads.listTreasuryExceptionQueue) {
      throw new Error(
        "listTreasuryExceptionQueue is not implemented on the DealReads port",
      );
    }

    return this.reads.listTreasuryExceptionQueue(validated);
  }
}
