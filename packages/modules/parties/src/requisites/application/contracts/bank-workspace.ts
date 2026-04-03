import { z } from "zod";

import { CurrencyOptionSchema } from "@bedrock/currencies/contracts";

import { RequisiteOwnerTypeSchema } from "./zod";

export const ListBankRequisiteWorkspaceQuerySchema = z.object({
  ownerId: z.uuid(),
  ownerType: RequisiteOwnerTypeSchema,
});

export type ListBankRequisiteWorkspaceQuery = z.infer<
  typeof ListBankRequisiteWorkspaceQuerySchema
>;

export const BankRequisiteWorkspaceProviderSchema = z.object({
  address: z.string().nullable(),
  bic: z.string().nullable(),
  country: z.string().nullable(),
  id: z.uuid(),
  name: z.string(),
  swift: z.string().nullable(),
});

export type BankRequisiteWorkspaceProvider = z.infer<
  typeof BankRequisiteWorkspaceProviderSchema
>;

export const BankRequisiteWorkspaceItemSchema = z.object({
  accountNo: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  contact: z.string().nullable(),
  corrAccount: z.string().nullable(),
  createdAt: z.iso.datetime(),
  currency: CurrencyOptionSchema,
  description: z.string().nullable(),
  iban: z.string().nullable(),
  id: z.uuid(),
  isDefault: z.boolean(),
  kind: z.literal("bank"),
  label: z.string(),
  notes: z.string().nullable(),
  ownerId: z.uuid(),
  ownerType: RequisiteOwnerTypeSchema,
  provider: BankRequisiteWorkspaceProviderSchema.nullable(),
  providerId: z.uuid(),
  updatedAt: z.iso.datetime(),
});

export type BankRequisiteWorkspaceItem = z.infer<
  typeof BankRequisiteWorkspaceItemSchema
>;

export const BankRequisiteWorkspaceResponseSchema = z.object({
  data: z.array(BankRequisiteWorkspaceItemSchema),
});

export type BankRequisiteWorkspaceResponse = z.infer<
  typeof BankRequisiteWorkspaceResponseSchema
>;
