import { z } from "zod";

import {
  TREASURY_ACCOUNT_KINDS,
} from "../../shared/domain/taxonomy";
import {
  dateInputSchema,
  jsonRecordSchema,
  nullableUuidSchema,
  optionalTextSchema,
  positiveMinorAmountStringSchema,
  uuidSchema,
} from "../../shared/application/zod";

export const TreasuryAccountKindSchema = z.enum(TREASURY_ACCOUNT_KINDS);

export const TreasuryAccountSchema = z.object({
  id: uuidSchema,
  kind: TreasuryAccountKindSchema,
  ownerEntityId: uuidSchema,
  operatorEntityId: uuidSchema,
  assetId: uuidSchema,
  provider: z.string().trim().max(255).nullable(),
  networkOrRail: z.string().trim().max(255).nullable(),
  accountReference: z.string().trim().min(1).max(255),
  reconciliationMode: z.string().trim().max(255).nullable(),
  finalityModel: z.string().trim().max(255).nullable(),
  segregationModel: z.string().trim().max(255).nullable(),
  canReceive: z.boolean(),
  canSend: z.boolean(),
  metadata: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
  archivedAt: dateInputSchema.nullable(),
});

export const CreateTreasuryAccountInputSchema = TreasuryAccountSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const TreasuryEndpointSchema = z.object({
  id: uuidSchema,
  accountId: uuidSchema,
  endpointType: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(255),
  label: z.string().trim().max(255).nullable(),
  memoTag: z.string().trim().max(255).nullable(),
  metadata: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
  archivedAt: dateInputSchema.nullable(),
});

export const CreateTreasuryEndpointInputSchema = TreasuryEndpointSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const ListTreasuryEndpointsInputSchema = z.object({
  accountId: uuidSchema.optional(),
  endpointType: z.string().trim().min(1).max(64).optional(),
  search: optionalTextSchema,
});

export const CounterpartyEndpointSchema = z.object({
  id: uuidSchema,
  counterpartyId: uuidSchema,
  assetId: uuidSchema,
  endpointType: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(255),
  label: z.string().trim().max(255).nullable(),
  memoTag: z.string().trim().max(255).nullable(),
  metadata: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
  archivedAt: dateInputSchema.nullable(),
});

export const CreateCounterpartyEndpointInputSchema =
  CounterpartyEndpointSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    archivedAt: true,
  });

export const ListCounterpartyEndpointsInputSchema = z.object({
  counterpartyId: uuidSchema.optional(),
  assetId: uuidSchema.optional(),
  endpointType: z.string().trim().min(1).max(64).optional(),
  search: optionalTextSchema,
});

export const ListTreasuryAccountsInputSchema = z.object({
  ownerEntityId: nullableUuidSchema.optional(),
  operatorEntityId: nullableUuidSchema.optional(),
  assetId: nullableUuidSchema.optional(),
  kind: TreasuryAccountKindSchema.optional(),
  canReceive: z.coerce.boolean().optional(),
  canSend: z.coerce.boolean().optional(),
  search: optionalTextSchema,
});

export const TreasuryAccountBalanceSchema = z.object({
  accountId: uuidSchema,
  assetId: uuidSchema,
  pendingMinor: z.string(),
  reservedMinor: z.string(),
  bookedMinor: z.string(),
  availableMinor: z.string(),
});

export const TreasuryAccountBalancesResponseSchema = z.object({
  data: z.array(TreasuryAccountBalanceSchema),
});

export const GetTreasuryAccountBalancesInputSchema = z.object({
  accountIds: z.array(uuidSchema).optional(),
});

export type TreasuryAccount = z.infer<typeof TreasuryAccountSchema>;
export type CreateTreasuryAccountInput = z.infer<
  typeof CreateTreasuryAccountInputSchema
>;
export type TreasuryEndpoint = z.infer<typeof TreasuryEndpointSchema>;
export type CreateTreasuryEndpointInput = z.infer<
  typeof CreateTreasuryEndpointInputSchema
>;
export type ListTreasuryEndpointsInput = z.infer<
  typeof ListTreasuryEndpointsInputSchema
>;
export type CounterpartyEndpoint = z.infer<typeof CounterpartyEndpointSchema>;
export type CreateCounterpartyEndpointInput = z.infer<
  typeof CreateCounterpartyEndpointInputSchema
>;
export type ListCounterpartyEndpointsInput = z.infer<
  typeof ListCounterpartyEndpointsInputSchema
>;
export type ListTreasuryAccountsInput = z.infer<
  typeof ListTreasuryAccountsInputSchema
>;
export type TreasuryAccountBalance = z.infer<
  typeof TreasuryAccountBalanceSchema
>;
export type GetTreasuryAccountBalancesInput = z.infer<
  typeof GetTreasuryAccountBalancesInputSchema
>;
