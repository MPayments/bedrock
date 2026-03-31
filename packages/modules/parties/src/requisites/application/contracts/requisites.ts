import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import {
  RequisiteCountryCodeSchema,
  RequisiteKindSchema,
  RequisiteOwnerTypeSchema,
} from "./zod";
import type { RequisiteSnapshot } from "../../domain/requisite";

export const RequisiteSchema = z.object({
  id: z.uuid(),
  ownerType: RequisiteOwnerTypeSchema,
  ownerId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string(),
  description: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  institutionName: z.string().nullable(),
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

export type Requisite = RequisiteSnapshot;

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
  currencyId: z.uuid(),
  kind: RequisiteKindSchema,
  label: z.string().trim().min(1).max(255),
  description: nullableText,
  beneficiaryName: nullableShortText,
  institutionName: nullableShortText,
  accountNo: nullableShortText,
  corrAccount: nullableShortText,
  iban: nullableShortText,
  bic: nullableShortText,
  swift: nullableShortText,
  bankAddress: nullableText,
  network: nullableShortText,
  assetCode: nullableShortText,
  address: nullableText,
  memoTag: nullableShortText,
  accountRef: nullableShortText,
  subaccountRef: nullableShortText,
  contact: nullableText,
  notes: nullableText,
  isDefault: z.boolean().optional().default(false),
});
export type CreateRequisiteInput = z.infer<typeof CreateRequisiteInputSchema>;

export const UpdateRequisiteInputSchema = z.object({
  providerId: z.uuid().exactOptional(),
  currencyId: z.uuid().exactOptional(),
  kind: RequisiteKindSchema.exactOptional(),
  label: z.string().trim().min(1).max(255).exactOptional(),
  description: nullableTextPatch,
  beneficiaryName: nullableShortTextPatch,
  institutionName: nullableShortTextPatch,
  accountNo: nullableShortTextPatch,
  corrAccount: nullableShortTextPatch,
  iban: nullableShortTextPatch,
  bic: nullableShortTextPatch,
  swift: nullableShortTextPatch,
  bankAddress: nullableTextPatch,
  network: nullableShortTextPatch,
  assetCode: nullableShortTextPatch,
  address: nullableTextPatch,
  memoTag: nullableShortTextPatch,
  accountRef: nullableShortTextPatch,
  subaccountRef: nullableShortTextPatch,
  contact: nullableTextPatch,
  notes: nullableTextPatch,
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
