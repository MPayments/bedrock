import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const SUB_AGENTS_LIST_CONTRACT = {
  sortableColumns: ["name", "commission"] as const,
  defaultSort: { id: "name" as const, desc: false },
  filters: {
    name: { kind: "string" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<readonly ["name", "commission"], any>;

export const ListSubAgentsQuerySchema = createListQuerySchemaFromContract(
  SUB_AGENTS_LIST_CONTRACT,
);

export type ListSubAgentsQuery = z.infer<typeof ListSubAgentsQuerySchema>;
