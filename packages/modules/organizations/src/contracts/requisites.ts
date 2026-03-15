import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";
import {
  CountryCodeSchema,
  RequisiteKindSchema,
} from "@bedrock/shared/requisites";

export const OrganizationRequisiteSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("organization"),
  ownerId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
  description: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  institutionName: z.string().nullable(),
  institutionCountry: z.string().nullable(),
  accountNo: z.string().nullable(),
  corrAccount: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  bankAddress: z.string().nullable(),
  network: z.string().nullable(),
  assetCode: z.string().nullable(),
  address: z.string().nullable(),
  memoTag: z.string().nullable(),
  accountRef: z.string().nullable(),
  subaccountRef: z.string().nullable(),
  contact: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});

export type OrganizationRequisite = z.infer<typeof OrganizationRequisiteSchema>;

export const OrganizationRequisiteAccountingBindingSchema = z.object({
  requisiteId: z.uuid(),
  organizationId: z.uuid(),
  bookId: z.uuid(),
  bookAccountInstanceId: z.uuid(),
  postingAccountNo: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrganizationRequisiteAccountingBinding = z.infer<
  typeof OrganizationRequisiteAccountingBindingSchema
>;

const ORGANIZATION_REQUISITES_SORTABLE_COLUMNS = [
  "label",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface OrganizationRequisitesListFilters {
  label: { kind: "string"; cardinality: "single" };
  organizationId: { kind: "string"; cardinality: "single" };
  currencyId: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  providerId: { kind: "string"; cardinality: "multi" };
}

export const ORGANIZATION_REQUISITES_LIST_CONTRACT: ListQueryContract<
  typeof ORGANIZATION_REQUISITES_SORTABLE_COLUMNS,
  OrganizationRequisitesListFilters
> = {
  sortableColumns: ORGANIZATION_REQUISITES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    label: { kind: "string", cardinality: "single" },
    organizationId: { kind: "string", cardinality: "single" },
    currencyId: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    providerId: { kind: "string", cardinality: "multi" },
  },
};

export const ListOrganizationRequisitesQuerySchema =
  createListQuerySchemaFromContract(ORGANIZATION_REQUISITES_LIST_CONTRACT);
export type ListOrganizationRequisitesQuery = z.infer<
  typeof ListOrganizationRequisitesQuerySchema
>;

const optionalText = z.string().trim().max(500).nullish();
const optionalShortText = z.string().trim().max(255).nullish();
const optionalCountry = CountryCodeSchema.nullish();

export const CreateOrganizationRequisiteInputSchema = z.object({
  organizationId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string().trim().min(1).max(255),
  description: optionalText,
  beneficiaryName: optionalShortText,
  institutionName: optionalShortText,
  institutionCountry: optionalCountry,
  accountNo: optionalShortText,
  corrAccount: optionalShortText,
  iban: optionalShortText,
  bic: optionalShortText,
  swift: optionalShortText,
  bankAddress: optionalText,
  network: optionalShortText,
  assetCode: optionalShortText,
  address: optionalText,
  memoTag: optionalShortText,
  accountRef: optionalShortText,
  subaccountRef: optionalShortText,
  contact: optionalText,
  notes: optionalText,
  isDefault: z.boolean().optional(),
});

export type CreateOrganizationRequisiteInput = z.infer<
  typeof CreateOrganizationRequisiteInputSchema
>;

export const UpdateOrganizationRequisiteInputSchema = z.object({
  providerId: z.uuid().optional(),
  currencyId: z.uuid().optional(),
  kind: RequisiteKindSchema.optional(),
  label: z.string().trim().min(1).max(255).optional(),
  description: optionalText.optional(),
  beneficiaryName: optionalShortText.optional(),
  institutionName: optionalShortText.optional(),
  institutionCountry: optionalCountry.optional(),
  accountNo: optionalShortText.optional(),
  corrAccount: optionalShortText.optional(),
  iban: optionalShortText.optional(),
  bic: optionalShortText.optional(),
  swift: optionalShortText.optional(),
  bankAddress: optionalText.optional(),
  network: optionalShortText.optional(),
  assetCode: optionalShortText.optional(),
  address: optionalText.optional(),
  memoTag: optionalShortText.optional(),
  accountRef: optionalShortText.optional(),
  subaccountRef: optionalShortText.optional(),
  contact: optionalText.optional(),
  notes: optionalText.optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateOrganizationRequisiteInput = z.infer<
  typeof UpdateOrganizationRequisiteInputSchema
>;

export const ListOrganizationRequisiteOptionsQuerySchema = z.object({
  organizationId: z.uuid().optional(),
});

export type ListOrganizationRequisiteOptionsQuery = z.infer<
  typeof ListOrganizationRequisiteOptionsQuerySchema
>;

export const UpsertOrganizationRequisiteAccountingBindingInputSchema = z.object({
  postingAccountNo: z.string().trim().regex(/^[0-9]{4}$/),
});

export type UpsertOrganizationRequisiteAccountingBindingInput = z.infer<
  typeof UpsertOrganizationRequisiteAccountingBindingInputSchema
>;

export const OrganizationRequisiteOptionSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("organization"),
  ownerId: z.uuid(),
  currencyId: z.uuid(),
  providerId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
});

export const OrganizationRequisiteOptionsResponseSchema = z.object({
  data: z.array(OrganizationRequisiteOptionSchema),
});

export type OrganizationRequisiteOption = z.infer<
  typeof OrganizationRequisiteOptionSchema
>;
