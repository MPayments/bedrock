import { z } from "zod";

import {
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

export const RecordTreasuryOperationFactInputSchema = z.object({
  amountMinor: OptionalMinorSchema,
  confirmedAt: z.coerce.date().nullable().optional().default(null),
  counterAmountMinor: OptionalMinorSchema,
  counterCurrencyId: OptionalUuidSchema,
  currencyId: OptionalUuidSchema,
  externalRecordId: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .nullable()
    .optional()
    .default(null),
  feeAmountMinor: OptionalMinorSchema,
  feeCurrencyId: OptionalUuidSchema,
  instructionId: OptionalUuidSchema,
  metadata: OptionalJsonRecordSchema,
  notes: OptionalTextSchema,
  operationId: z.uuid(),
  providerRef: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .nullable()
    .optional()
    .default(null),
  recordedAt: z.coerce.date().nullable().optional().default(null),
  routeLegId: OptionalUuidSchema,
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string().trim().min(1).max(255),
});

export type RecordTreasuryOperationFactInput = z.infer<
  typeof RecordTreasuryOperationFactInputSchema
>;
