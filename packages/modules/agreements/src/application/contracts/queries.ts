import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const AGREEMENTS_SORTABLE_COLUMNS = [
  "createdAt",
  "updatedAt",
  "contractNumber",
] as const;

interface AgreementsListFilters {
  customerId: { kind: "string"; cardinality: "single" };
  organizationId: { kind: "string"; cardinality: "single" };
  isActive: { kind: "boolean"; cardinality: "single" };
}

export const AGREEMENTS_LIST_CONTRACT: ListQueryContract<
  typeof AGREEMENTS_SORTABLE_COLUMNS,
  AgreementsListFilters
> = {
  sortableColumns: AGREEMENTS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    customerId: { kind: "string", cardinality: "single" },
    organizationId: { kind: "string", cardinality: "single" },
    isActive: { kind: "boolean", cardinality: "single" },
  },
};

export const ListAgreementsQuerySchema = createListQuerySchemaFromContract(
  AGREEMENTS_LIST_CONTRACT,
);

export type ListAgreementsQuery = z.infer<typeof ListAgreementsQuerySchema>;
