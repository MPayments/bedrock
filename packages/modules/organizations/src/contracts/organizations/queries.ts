import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const ORGANIZATIONS_SORTABLE_COLUMNS = [
  "shortName",
  "fullName",
  "country",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface OrganizationsListFilters {
  shortName: { kind: "string"; cardinality: "single" };
  fullName: { kind: "string"; cardinality: "single" };
  country: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
}

export const ORGANIZATIONS_LIST_CONTRACT: ListQueryContract<
  typeof ORGANIZATIONS_SORTABLE_COLUMNS,
  OrganizationsListFilters
> = {
  sortableColumns: ORGANIZATIONS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    shortName: { kind: "string", cardinality: "single" },
    fullName: { kind: "string", cardinality: "single" },
    country: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
  },
};

export const ListOrganizationsQuerySchema = createListQuerySchemaFromContract(
  ORGANIZATIONS_LIST_CONTRACT,
);

export type ListOrganizationsQuery = z.infer<
  typeof ListOrganizationsQuerySchema
>;
