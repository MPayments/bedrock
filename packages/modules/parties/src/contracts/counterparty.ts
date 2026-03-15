import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import {
  CountryCodeSchema,
  CounterpartyKindSchema,
} from "./party-kind";

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
  customerId: { kind: "string"; cardinality: "single" };
  shortName: { kind: "string"; cardinality: "single" };
  fullName: { kind: "string"; cardinality: "single" };
  country: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  groupIds: { kind: "string"; cardinality: "multi" };
}

export const COUNTERPARTIES_LIST_CONTRACT: ListQueryContract<
  typeof COUNTERPARTIES_SORTABLE_COLUMNS,
  CounterpartiesListFilters
> = {
  sortableColumns: COUNTERPARTIES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    customerId: { kind: "string", cardinality: "single" },
    shortName: { kind: "string", cardinality: "single" },
    fullName: { kind: "string", cardinality: "single" },
    country: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    groupIds: { kind: "string", cardinality: "multi" },
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

export const CounterpartyOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const CounterpartyOptionsResponseSchema = z.object({
  data: z.array(CounterpartyOptionSchema),
});

export type CounterpartyOption = z.infer<typeof CounterpartyOptionSchema>;
