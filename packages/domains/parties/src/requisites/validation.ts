import { z } from "zod";

import { ValidationError } from "@bedrock/common/errors";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/common/pagination";

import {
  collectRequisiteFieldIssues,
  CountryAlpha2Schema,
  RequisiteKindSchema,
  type RequisiteFieldsInput,
} from "./shared";

export const RequisiteOwnerTypeSchema = z.enum(["organization", "counterparty"]);
export type RequisiteOwnerType = z.infer<typeof RequisiteOwnerTypeSchema>;

const requisiteFieldsSchema = z.object({
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
});

export const RequisiteSchema = z.object({
  id: z.uuid(),
  ownerType: RequisiteOwnerTypeSchema,
  ownerId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  ...requisiteFieldsSchema.shape,
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});
export type Requisite = z.infer<typeof RequisiteSchema>;

export const RequisiteAccountingBindingSchema = z.object({
  requisiteId: z.uuid(),
  organizationId: z.uuid(),
  bookId: z.uuid(),
  bookAccountInstanceId: z.uuid(),
  postingAccountNo: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type RequisiteAccountingBinding = z.infer<
  typeof RequisiteAccountingBindingSchema
>;

const REQUISITES_SORTABLE_COLUMNS = [
  "label",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface RequisitesListFilters {
  label: { kind: "string"; cardinality: "single" };
  ownerType: { kind: "string"; cardinality: "single" };
  ownerId: { kind: "string"; cardinality: "single" };
  currencyId: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  providerId: { kind: "string"; cardinality: "multi" };
}

export const REQUISITES_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITES_SORTABLE_COLUMNS,
  RequisitesListFilters
> = {
  sortableColumns: REQUISITES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    label: { kind: "string", cardinality: "single" },
    ownerType: { kind: "string", cardinality: "single" },
    ownerId: { kind: "string", cardinality: "single" },
    currencyId: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    providerId: { kind: "string", cardinality: "multi" },
  },
};

export const ListRequisitesQuerySchema = createListQuerySchemaFromContract(
  REQUISITES_LIST_CONTRACT,
);
export type ListRequisitesQuery = z.infer<typeof ListRequisitesQuerySchema>;

const optionalText = z.string().trim().max(500).nullish();
const optionalShortText = z.string().trim().max(255).nullish();
const optionalCountry = CountryAlpha2Schema.nullish();

export const CreateRequisiteInputSchema = z.object({
  ownerType: RequisiteOwnerTypeSchema,
  ownerId: z.uuid(),
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
export type CreateRequisiteInput = z.infer<typeof CreateRequisiteInputSchema>;

export const UpdateRequisiteInputSchema = z.object({
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
export type UpdateRequisiteInput = z.infer<typeof UpdateRequisiteInputSchema>;

export const ListRequisiteOptionsQuerySchema = z
  .object({
    ownerType: RequisiteOwnerTypeSchema.optional(),
    ownerId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ownerId && !value.ownerType) {
      ctx.addIssue({
        code: "custom",
        path: ["ownerType"],
        message: "ownerType is required when ownerId is provided",
      });
    }
  });
export type ListRequisiteOptionsQuery = z.infer<
  typeof ListRequisiteOptionsQuerySchema
>;

export const UpsertRequisiteAccountingBindingInputSchema = z.object({
  postingAccountNo: z.string().trim().regex(/^[0-9]{4}$/),
});
export type UpsertRequisiteAccountingBindingInput = z.infer<
  typeof UpsertRequisiteAccountingBindingInputSchema
>;

export type RequisiteFieldsValidationInput = RequisiteFieldsInput;

export function validateRequisiteFields(input: RequisiteFieldsValidationInput) {
  const issues = collectRequisiteFieldIssues(input);
  if (issues.length > 0) {
    throw new ValidationError(issues.join("; "));
  }
}
