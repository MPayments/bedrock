import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import { DEAL_STATUS_VALUES } from "../../domain/deal-status";

export const DEALS_LIST_CONTRACT = {
  sortableColumns: ["createdAt", "updatedAt"] as const,
  defaultSort: { id: "createdAt" as const, desc: true },
  filters: {
    status: {
      kind: "string" as const,
      cardinality: "multi" as const,
      enumValues: DEAL_STATUS_VALUES,
    },
    agentId: { kind: "number" as const, cardinality: "single" as const, int: true },
    clientId: { kind: "number" as const, cardinality: "single" as const, int: true },
    dateFrom: { kind: "string" as const, cardinality: "single" as const },
    dateTo: { kind: "string" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<
  readonly ["createdAt", "updatedAt"],
  any
>;

export const ListDealsQuerySchema = createListQuerySchemaFromContract(
  DEALS_LIST_CONTRACT,
);

export type ListDealsQuery = z.infer<typeof ListDealsQuerySchema>;
