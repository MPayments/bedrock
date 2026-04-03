import { z } from "zod";

import {
  TreasuryOperationKindSchema,
  TreasuryOperationStateSchema,
} from "./zod";

const TreasuryOperationFinanceQueueSchema = z.enum([
  "funding",
  "execution",
  "failed_instruction",
]);

const TreasuryOperationDealTypeSchema = z.enum([
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
]);

const TreasuryOperationLegKindSchema = z.enum([
  "collect",
  "convert",
  "payout",
  "transit_hold",
  "settle_exporter",
]);

export const TreasuryOperationSchema = z.object({
  amountMinor: z.string().nullable(),
  counterAmountMinor: z.string().nullable(),
  counterCurrencyId: z.uuid().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  dealId: z.uuid().nullable(),
  id: z.uuid(),
  internalEntityOrganizationId: z.uuid().nullable(),
  kind: TreasuryOperationKindSchema,
  quoteId: z.uuid().nullable(),
  sourceRef: z.string(),
  state: TreasuryOperationStateSchema,
  updatedAt: z.date(),
});

export type TreasuryOperation = z.infer<typeof TreasuryOperationSchema>;

export const TreasuryOperationInstructionStatusSchema = z.enum([
  "planned",
  "blocked",
  "failed",
]);

export const TreasuryOperationMoneySummarySchema = z.object({
  amountMinor: z.string().nullable(),
  currency: z.string().nullable(),
  currencyId: z.uuid().nullable(),
  formatted: z.string(),
});

export const TreasuryOperationAccountSummarySchema = z.object({
  identity: z.string().nullable(),
  label: z.string(),
});

export const TreasuryOperationInternalEntitySchema = z.object({
  name: z.string().nullable(),
  organizationId: z.uuid().nullable(),
});

export const TreasuryOperationDealRefSchema = z
  .object({
    applicantName: z.string().nullable(),
    dealId: z.uuid(),
    status: z.string(),
    type: TreasuryOperationDealTypeSchema,
  })
  .nullable();

export const TreasuryOperationLegRefSchema = z
  .object({
    idx: z.number().int().positive(),
    kind: TreasuryOperationLegKindSchema,
    legId: z.uuid(),
  })
  .nullable();

export const TreasuryOperationQueueContextSchema = z
  .object({
    blockers: z.array(z.string()),
    queue: TreasuryOperationFinanceQueueSchema,
    queueReason: z.string(),
  })
  .nullable();

export const TreasuryOperationWorkspaceItemSchema = z.object({
  amount: TreasuryOperationMoneySummarySchema,
  counterAmount: TreasuryOperationMoneySummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  dealRef: TreasuryOperationDealRefSchema,
  destinationAccount: TreasuryOperationAccountSummarySchema,
  id: z.uuid(),
  instructionStatus: TreasuryOperationInstructionStatusSchema,
  internalEntity: TreasuryOperationInternalEntitySchema,
  kind: TreasuryOperationKindSchema,
  legRef: TreasuryOperationLegRefSchema,
  nextAction: z.string(),
  providerRoute: z.string(),
  sourceAccount: TreasuryOperationAccountSummarySchema,
  sourceRef: z.string(),
  state: TreasuryOperationStateSchema,
});

export const TreasuryOperationViewCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  exceptions: z.number().int().nonnegative(),
  fx: z.number().int().nonnegative(),
  incoming: z.number().int().nonnegative(),
  intercompany: z.number().int().nonnegative(),
  intracompany: z.number().int().nonnegative(),
  outgoing: z.number().int().nonnegative(),
});

export const TreasuryOperationWorkspaceListResponseSchema = z.object({
  data: z.array(TreasuryOperationWorkspaceItemSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  viewCounts: TreasuryOperationViewCountsSchema,
});

export const TreasuryOperationWorkspaceDetailSchema =
  TreasuryOperationWorkspaceItemSchema.extend({
    dealWorkbenchHref: z.string().nullable(),
    queueContext: TreasuryOperationQueueContextSchema,
  });

export type TreasuryOperationInstructionStatus = z.infer<
  typeof TreasuryOperationInstructionStatusSchema
>;
export type TreasuryOperationMoneySummary = z.infer<
  typeof TreasuryOperationMoneySummarySchema
>;
export type TreasuryOperationAccountSummary = z.infer<
  typeof TreasuryOperationAccountSummarySchema
>;
export type TreasuryOperationInternalEntity = z.infer<
  typeof TreasuryOperationInternalEntitySchema
>;
export type TreasuryOperationDealRef = z.infer<
  typeof TreasuryOperationDealRefSchema
>;
export type TreasuryOperationLegRef = z.infer<
  typeof TreasuryOperationLegRefSchema
>;
export type TreasuryOperationQueueContext = z.infer<
  typeof TreasuryOperationQueueContextSchema
>;
export type TreasuryOperationWorkspaceItem = z.infer<
  typeof TreasuryOperationWorkspaceItemSchema
>;
export type TreasuryOperationViewCounts = z.infer<
  typeof TreasuryOperationViewCountsSchema
>;
export type TreasuryOperationWorkspaceListResponse = z.infer<
  typeof TreasuryOperationWorkspaceListResponseSchema
>;
export type TreasuryOperationWorkspaceDetail = z.infer<
  typeof TreasuryOperationWorkspaceDetailSchema
>;
