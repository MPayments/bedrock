import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const COUNTERPARTY_REQUISITES_SORTABLE_COLUMNS = [
  "label",
  "kind",
  "createdAt",
  "updatedAt",
] as const;

interface CounterpartyRequisitesListFilters {
  label: { kind: "string"; cardinality: "single" };
  counterpartyId: { kind: "string"; cardinality: "single" };
  currencyId: { kind: "string"; cardinality: "multi" };
  kind: { kind: "string"; cardinality: "multi" };
  providerId: { kind: "string"; cardinality: "multi" };
}

export const COUNTERPARTY_REQUISITES_LIST_CONTRACT: ListQueryContract<
  typeof COUNTERPARTY_REQUISITES_SORTABLE_COLUMNS,
  CounterpartyRequisitesListFilters
> = {
  sortableColumns: COUNTERPARTY_REQUISITES_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    label: { kind: "string", cardinality: "single" },
    counterpartyId: { kind: "string", cardinality: "single" },
    currencyId: { kind: "string", cardinality: "multi" },
    kind: { kind: "string", cardinality: "multi" },
    providerId: { kind: "string", cardinality: "multi" },
  },
};

export const ListCounterpartyRequisitesQuerySchema =
  createListQuerySchemaFromContract(COUNTERPARTY_REQUISITES_LIST_CONTRACT);
export type ListCounterpartyRequisitesQuery = z.infer<
  typeof ListCounterpartyRequisitesQuerySchema
>;

export const ListCounterpartyRequisiteOptionsQuerySchema = z.object({
  counterpartyId: z.uuid().optional(),
});

export type ListCounterpartyRequisiteOptionsQuery = z.infer<
  typeof ListCounterpartyRequisiteOptionsQuerySchema
>;
