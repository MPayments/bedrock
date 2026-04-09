import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import {
  RequisiteKindSchema,
  RequisiteOwnerTypeSchema,
} from "./zod";
import type { RequisiteSnapshot } from "../../domain/requisite";

export const RequisiteIdentifierSchema = z.object({
  id: z.uuid(),
  requisiteId: z.uuid(),
  scheme: z.string(),
  value: z.string(),
  normalizedValue: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RequisiteIdentifier = z.infer<typeof RequisiteIdentifierSchema>;

export const RequisiteIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: z.string().trim().min(1),
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});

export type RequisiteIdentifierInput = z.infer<
  typeof RequisiteIdentifierInputSchema
>;

export const RequisiteListItemSchema = z.object({
  id: z.uuid(),
  ownerType: RequisiteOwnerTypeSchema,
  ownerId: z.uuid(),
  organizationId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  providerId: z.uuid(),
  providerBranchId: z.uuid().nullable(),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
  beneficiaryName: z.string().nullable(),
  beneficiaryNameLocal: z.string().nullable(),
  beneficiaryAddress: z.string().nullable(),
  paymentPurposeTemplate: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  archivedAt: z.date().nullable(),
});

export const RequisiteSchema = RequisiteListItemSchema.extend({
  identifiers: z.array(RequisiteIdentifierSchema),
});

export type Requisite = z.infer<typeof RequisiteSchema>;
export type RequisiteListItem = z.infer<typeof RequisiteListItemSchema>;
export type RequisiteAnchorSnapshot = RequisiteSnapshot;

export const RequisiteAccountingBindingSchema = z.object({
  requisiteId: z.uuid(),
  organizationId: z.uuid(),
  currencyCode: z.string(),
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
export type ListRequisitesInput = ListRequisitesQuery;

const nullableText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableShortText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableTextPatch = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .transform((value) => trimToNull(value))
  .exactOptional();
const nullableShortTextPatch = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .transform((value) => trimToNull(value))
  .exactOptional();

export const CreateRequisiteInputSchema = z.object({
  ownerType: RequisiteOwnerTypeSchema,
  ownerId: z.uuid(),
  providerId: z.uuid(),
  providerBranchId: z.uuid().nullish().transform((value) => value ?? null),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string().trim().min(1).max(255),
  beneficiaryName: nullableShortText,
  beneficiaryNameLocal: nullableShortText,
  beneficiaryAddress: nullableText,
  paymentPurposeTemplate: nullableText,
  notes: nullableText,
  identifiers: z.array(RequisiteIdentifierInputSchema).min(1),
  isDefault: z.boolean().optional().default(false),
});
export type CreateRequisiteInput = z.infer<typeof CreateRequisiteInputSchema>;

export const UpdateRequisiteInputSchema = z.object({
  providerId: z.uuid().exactOptional(),
  providerBranchId: z.uuid().nullable().exactOptional(),
  currencyId: z.uuid().exactOptional(),
  kind: RequisiteKindSchema.exactOptional(),
  label: z.string().trim().min(1).max(255).exactOptional(),
  beneficiaryName: nullableShortTextPatch,
  beneficiaryNameLocal: nullableShortTextPatch,
  beneficiaryAddress: nullableTextPatch,
  paymentPurposeTemplate: nullableTextPatch,
  notes: nullableTextPatch,
  identifiers: z.array(RequisiteIdentifierInputSchema).exactOptional(),
  isDefault: z.boolean().exactOptional(),
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
export type ListRequisiteOptionsInput = ListRequisiteOptionsQuery;

export const UpsertRequisiteAccountingBindingInputSchema = z.object({
  postingAccountNo: z.string().trim().regex(/^[0-9]{4}$/),
});
export type UpsertRequisiteAccountingBindingInput = z.infer<
  typeof UpsertRequisiteAccountingBindingInputSchema
>;

export const RequisiteOptionSchema = z.object({
  id: z.uuid(),
  ownerType: RequisiteOwnerTypeSchema,
  ownerId: z.uuid(),
  currencyId: z.uuid(),
  providerId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
});

export const RequisiteOptionsResponseSchema = z.object({
  data: z.array(RequisiteOptionSchema),
});

export type RequisiteOption = z.infer<typeof RequisiteOptionSchema>;
