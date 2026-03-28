import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const CLIENTS_LIST_CONTRACT = {
  sortableColumns: ["orgName", "createdAt"] as const,
  defaultSort: { id: "createdAt" as const, desc: true },
  filters: {
    orgName: { kind: "string" as const, cardinality: "single" as const },
    inn: { kind: "string" as const, cardinality: "single" as const },
    isDeleted: { kind: "boolean" as const, cardinality: "single" as const },
    subAgentId: { kind: "number" as const, cardinality: "single" as const, int: true },
    userId: { kind: "string" as const, cardinality: "single" as const },
    search: { kind: "string" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<
  readonly ["orgName", "createdAt"],
  any
>;

export const ListClientsQuerySchema = createListQuerySchemaFromContract(
  CLIENTS_LIST_CONTRACT,
);

export type ListClientsQuery = z.infer<typeof ListClientsQuerySchema>;
