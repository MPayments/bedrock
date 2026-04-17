import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const REQUISITE_PROVIDERS_SORTABLE_COLUMNS = [
  "displayName",
  "kind",
  "country",
  "createdAt",
  "updatedAt",
] as const;

interface RequisiteProvidersListFilters {
  id: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  country: { kind: "string"; cardinality: "multi" };
  displayName: { kind: "string"; cardinality: "single" };
  legalName: { kind: "string"; cardinality: "single" };
  bic: { kind: "string"; cardinality: "multi" };
  swift: { kind: "string"; cardinality: "multi" };
}

export const REQUISITE_PROVIDERS_LIST_CONTRACT: ListQueryContract<
  typeof REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  RequisiteProvidersListFilters
> = {
  sortableColumns: REQUISITE_PROVIDERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    id: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    country: { kind: "string", cardinality: "multi" },
    displayName: { kind: "string", cardinality: "single" },
    legalName: { kind: "string", cardinality: "single" },
    bic: { kind: "string", cardinality: "multi" },
    swift: { kind: "string", cardinality: "multi" },
  },
};

export const ListRequisiteProvidersQuerySchema =
  createListQuerySchemaFromContract(REQUISITE_PROVIDERS_LIST_CONTRACT);

export type ListRequisiteProvidersQuery = z.infer<
  typeof ListRequisiteProvidersQuerySchema
>;

const idsPreprocess = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.flatMap((item) => {
    if (typeof item !== "string") {
      return [item];
    }
    return item
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  });
};

export const ListRequisiteProviderOptionsQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  ids: z.preprocess(idsPreprocess, z.array(z.uuid()).optional()).optional(),
  kind: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type ListRequisiteProviderOptionsQuery = z.infer<
  typeof ListRequisiteProviderOptionsQuerySchema
>;
