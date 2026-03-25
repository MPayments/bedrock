import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const CONTRACTS_LIST_CONTRACT = {
  sortableColumns: ["createdAt", "contractNumber"] as const,
  defaultSort: { id: "createdAt" as const, desc: true },
  filters: {
    clientId: { kind: "number" as const, cardinality: "single" as const, int: true },
    isActive: { kind: "boolean" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<
  readonly ["createdAt", "contractNumber"],
  any
>;

export const ListContractsQuerySchema = createListQuerySchemaFromContract(
  CONTRACTS_LIST_CONTRACT,
);

export type ListContractsQuery = z.infer<typeof ListContractsQuerySchema>;
