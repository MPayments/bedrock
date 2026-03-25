import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const AGENTS_LIST_CONTRACT = {
  sortableColumns: ["name", "createdAt"] as const,
  defaultSort: { id: "name" as const, desc: false },
  filters: {
    status: {
      kind: "string" as const,
      cardinality: "single" as const,
      enumValues: ["active", "inactive"] as const,
    },
    isAllowed: { kind: "boolean" as const, cardinality: "single" as const },
    isAdmin: { kind: "boolean" as const, cardinality: "single" as const },
    role: {
      kind: "string" as const,
      cardinality: "single" as const,
      enumValues: ["agent", "customer"] as const,
    },
    name: { kind: "string" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<readonly ["name", "createdAt"], any>;

export const ListAgentsQuerySchema = createListQuerySchemaFromContract(
  AGENTS_LIST_CONTRACT,
);

export type ListAgentsQuery = z.infer<typeof ListAgentsQuerySchema>;
