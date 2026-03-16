import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

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

export const ListOrganizationRequisiteOptionsQuerySchema = z.object({
  organizationId: z.uuid().optional(),
});

export type ListOrganizationRequisiteOptionsQuery = z.infer<
  typeof ListOrganizationRequisiteOptionsQuerySchema
>;
