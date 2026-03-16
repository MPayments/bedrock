import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";
import {
  DomainError,
  readCauseString,
  trimToNull,
} from "@bedrock/shared/core/domain";

import { validateRequisiteProviderDetails } from "../domain/requisite-provider";
import { CountryCodeSchema, RequisiteKindSchema } from "./shared";

export const RequisiteProviderSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  address: z.string().nullable(),
  contact: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RequisiteProvider = z.infer<typeof RequisiteProviderSchema>;

const REQUISITE_PROVIDERS_SORTABLE_COLUMNS = [
  "name",
  "kind",
  "country",
  "createdAt",
  "updatedAt",
] as const;

interface RequisiteProvidersListFilters {
  kind: { kind: "string"; cardinality: "multi" };
  country: { kind: "string"; cardinality: "multi" };
  name: { kind: "string"; cardinality: "single" };
}

export const REQUISITE_PROVIDERS_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  RequisiteProvidersListFilters
> = {
  sortableColumns: REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    kind: { kind: "string", cardinality: "multi" },
    country: { kind: "string", cardinality: "multi" },
    name: { kind: "string", cardinality: "single" },
  },
};

export const ListRequisiteProvidersQuerySchema =
  createListQuerySchemaFromContract(REQUISITE_PROVIDERS_LIST_CONTRACT);

export type ListRequisiteProvidersQuery = z.infer<
  typeof ListRequisiteProvidersQuerySchema
>;

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
const nullableCountry = CountryCodeSchema.nullish().transform(
  (value) => value ?? null,
);
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
const nullableCountryPatch = CountryCodeSchema.nullable().exactOptional();

const providerFieldsSchema = z.object({
  kind: RequisiteKindSchema,
  name: z.string().trim().min(1).max(255),
  description: nullableText,
  country: nullableCountry,
  address: nullableText,
  contact: nullableText,
  bic: nullableShortText,
  swift: nullableShortText,
});

function refineProviderRules(
  value: {
    kind: string;
    country: string | null;
    bic: string | null;
    swift: string | null;
  },
  ctx: z.RefinementCtx,
) {
  try {
    validateRequisiteProviderDetails({
      kind: value.kind as never,
      name: "validated",
      description: null,
      country: value.country,
      address: null,
      contact: null,
      bic: value.bic,
      swift: value.swift,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      ctx.addIssue({
        code: "custom",
        path: [readCauseString(error, "field") ?? "kind"],
        message: error.message,
      });
      return;
    }

    throw error;
  }
}

export const CreateRequisiteProviderInputSchema =
  providerFieldsSchema.superRefine(refineProviderRules);
export type CreateRequisiteProviderInput = z.input<
  typeof CreateRequisiteProviderInputSchema
>;

export const UpdateRequisiteProviderInputSchema = z.object({
  kind: RequisiteKindSchema.exactOptional(),
  name: z.string().trim().min(1).max(255).exactOptional(),
  description: nullableTextPatch,
  country: nullableCountryPatch,
  address: nullableTextPatch,
  contact: nullableTextPatch,
  bic: nullableShortTextPatch,
  swift: nullableShortTextPatch,
});
export type UpdateRequisiteProviderInput = z.input<
  typeof UpdateRequisiteProviderInputSchema
>;

export const RequisiteProviderOptionSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  name: z.string(),
  label: z.string(),
});

export const RequisiteProviderOptionsResponseSchema = z.object({
  data: z.array(RequisiteProviderOptionSchema),
});

export type RequisiteProviderOption = z.infer<
  typeof RequisiteProviderOptionSchema
>;
