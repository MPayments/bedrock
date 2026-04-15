import { z } from "zod";

import {
  TreasuryCashMovementDirectionSchema,
  TreasuryOperationFactSourceKindSchema,
  TreasuryOperationKindSchema,
} from "./zod";

const OptionalJsonRecordSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional()
  .default(null);
const OptionalMinorSchema = z.bigint().nullable().optional().default(null);
const OptionalUuidSchema = z.uuid().nullable().optional().default(null);
const OptionalTextSchema = z
  .string()
  .trim()
  .max(1000)
  .nullable()
  .optional()
  .default(null);

export const CreatePlannedTreasuryOperationInputSchema = z.object({
  amountMinor: z.bigint().nullable().optional().default(null),
  counterAmountMinor: z.bigint().nullable().optional().default(null),
  counterCurrencyId: z.uuid().nullable().optional().default(null),
  currencyId: z.uuid().nullable().optional().default(null),
  customerId: z.uuid().nullable().optional().default(null),
  dealId: z.uuid(),
  id: z.uuid(),
  internalEntityOrganizationId: z.uuid().nullable().optional().default(null),
  kind: TreasuryOperationKindSchema,
  quoteId: z.uuid().nullable().optional().default(null),
  routeLegId: z.uuid().nullable().optional().default(null),
  sourceRef: z.string().trim().min(1).max(255),
});

export type CreatePlannedTreasuryOperationInput = z.infer<
  typeof CreatePlannedTreasuryOperationInputSchema
>;

const OptionalShortTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .optional()
  .default(null);

export const RecordTreasuryExecutionFillInputSchema = z.object({
  actualRateDen: OptionalMinorSchema,
  actualRateNum: OptionalMinorSchema,
  boughtAmountMinor: OptionalMinorSchema,
  boughtCurrencyId: OptionalUuidSchema,
  calculationSnapshotId: OptionalUuidSchema,
  confirmedAt: z.coerce.date().nullable().optional().default(null),
  executedAt: z.coerce.date().nullable().optional().default(null),
  externalRecordId: OptionalShortTextSchema,
  fillSequence: z.number().int().positive().nullable().optional().default(null),
  instructionId: OptionalUuidSchema,
  metadata: OptionalJsonRecordSchema,
  notes: OptionalTextSchema,
  operationId: z.uuid(),
  providerCounterpartyId: OptionalUuidSchema,
  providerRef: OptionalShortTextSchema,
  routeLegId: OptionalUuidSchema,
  routeVersionId: OptionalUuidSchema,
  soldAmountMinor: OptionalMinorSchema,
  soldCurrencyId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string().trim().min(1).max(255),
});

export type RecordTreasuryExecutionFillInput = z.infer<
  typeof RecordTreasuryExecutionFillInputSchema
>;

export const RecordTreasuryExecutionFeeInputSchema = z.object({
  amountMinor: OptionalMinorSchema,
  calculationSnapshotId: OptionalUuidSchema,
  chargedAt: z.coerce.date().nullable().optional().default(null),
  componentCode: OptionalShortTextSchema,
  confirmedAt: z.coerce.date().nullable().optional().default(null),
  currencyId: OptionalUuidSchema,
  externalRecordId: OptionalShortTextSchema,
  feeFamily: z.string().trim().min(1).max(64),
  fillId: OptionalUuidSchema,
  instructionId: OptionalUuidSchema,
  metadata: OptionalJsonRecordSchema,
  notes: OptionalTextSchema,
  operationId: z.uuid(),
  providerCounterpartyId: OptionalUuidSchema,
  providerRef: OptionalShortTextSchema,
  routeComponentId: OptionalUuidSchema,
  routeLegId: OptionalUuidSchema,
  routeVersionId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string().trim().min(1).max(255),
});

export type RecordTreasuryExecutionFeeInput = z.infer<
  typeof RecordTreasuryExecutionFeeInputSchema
>;

export const RecordTreasuryCashMovementInputSchema = z.object({
  accountRef: OptionalShortTextSchema,
  amountMinor: OptionalMinorSchema,
  bookedAt: z.coerce.date().nullable().optional().default(null),
  calculationSnapshotId: OptionalUuidSchema,
  confirmedAt: z.coerce.date().nullable().optional().default(null),
  currencyId: OptionalUuidSchema,
  direction: TreasuryCashMovementDirectionSchema,
  externalRecordId: OptionalShortTextSchema,
  instructionId: OptionalUuidSchema,
  metadata: OptionalJsonRecordSchema,
  notes: OptionalTextSchema,
  operationId: z.uuid(),
  providerCounterpartyId: OptionalUuidSchema,
  providerRef: OptionalShortTextSchema,
  requisiteId: OptionalUuidSchema,
  routeLegId: OptionalUuidSchema,
  routeVersionId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string().trim().min(1).max(255),
  statementRef: OptionalShortTextSchema,
  valueDate: z.coerce.date().nullable().optional().default(null),
});

export type RecordTreasuryCashMovementInput = z.infer<
  typeof RecordTreasuryCashMovementInputSchema
>;
