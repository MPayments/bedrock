import { z } from "zod";

import { COUNTRY_ALPHA2_SET } from "@bedrock/countries";
import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/kernel/pagination";

export const CounterpartyKindSchema = z.enum(["legal_entity", "individual"]);
export type CounterpartyKind = z.infer<typeof CounterpartyKindSchema>;

export const CounterpartyGroupRootCodeSchema = z.enum([
  "treasury",
  "customers",
]);
export type CounterpartyGroupRootCode = z.infer<
  typeof CounterpartyGroupRootCodeSchema
>;

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => COUNTRY_ALPHA2_SET.has(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );

export const CounterpartySchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  customerId: z.uuid().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: CountryCodeSchema.nullable(),
  kind: CounterpartyKindSchema,
  groupIds: z.array(z.uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Counterparty = z.infer<typeof CounterpartySchema>;

const COUNTERPARTIES_SORTABLE_COLUMNS = [
  "shortName",
  "fullName",
  "country",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface CounterpartiesListFilters {
  shortName: { kind: "string"; cardinality: "single" };
  fullName: { kind: "string"; cardinality: "single" };
  country: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  groupIds: { kind: "string"; cardinality: "multi" };
  groupRoot: { kind: "string"; cardinality: "multi" };
}

export const COUNTERPARTIES_LIST_CONTRACT: ListQueryContract<
  typeof COUNTERPARTIES_SORTABLE_COLUMNS,
  CounterpartiesListFilters
> = {
  sortableColumns: COUNTERPARTIES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    shortName: { kind: "string", cardinality: "single" },
    fullName: { kind: "string", cardinality: "single" },
    country: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    groupIds: { kind: "string", cardinality: "multi" },
    groupRoot: { kind: "string", cardinality: "multi" },
  },
};

export const ListCounterpartiesQuerySchema = createListQuerySchemaFromContract(
  COUNTERPARTIES_LIST_CONTRACT,
);

export type ListCounterpartiesQuery = z.infer<
  typeof ListCounterpartiesQuerySchema
>;

export const CreateCounterpartyInputSchema = z.object({
  shortName: z.string().min(1, "shortName is required"),
  fullName: z.string().min(1, "fullName is required"),
  kind: CounterpartyKindSchema.default("legal_entity"),
  country: CountryCodeSchema.optional(),
  externalId: z.string().optional(),
  description: z.string().optional(),
  customerId: z.uuid().nullable().optional(),
  groupIds: z.array(z.uuid()).default([]),
});

export type CreateCounterpartyInput = z.infer<
  typeof CreateCounterpartyInputSchema
>;

export const UpdateCounterpartyInputSchema = z.object({
  shortName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  kind: CounterpartyKindSchema.optional(),
  country: CountryCodeSchema.nullable().optional(),
  externalId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  customerId: z.uuid().nullable().optional(),
  groupIds: z.array(z.uuid()).optional(),
});

export type UpdateCounterpartyInput = z.infer<
  typeof UpdateCounterpartyInputSchema
>;

export const CounterpartyGroupSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  isSystem: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CounterpartyGroup = z.infer<typeof CounterpartyGroupSchema>;

export const ListCounterpartyGroupsQuerySchema = z.object({
  parentId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  includeSystem: z.coerce.boolean().optional(),
});

export type ListCounterpartyGroupsQuery = z.infer<
  typeof ListCounterpartyGroupsQuerySchema
>;

export const CreateCounterpartyGroupInputSchema = z.object({
  code: z.string().min(1, "code is required"),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  parentId: z.uuid().optional(),
  customerId: z.uuid().optional(),
});

export type CreateCounterpartyGroupInput = z.infer<
  typeof CreateCounterpartyGroupInputSchema
>;

export const UpdateCounterpartyGroupInputSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  customerId: z.uuid().nullable().optional(),
});

export type UpdateCounterpartyGroupInput = z.infer<
  typeof UpdateCounterpartyGroupInputSchema
>;
