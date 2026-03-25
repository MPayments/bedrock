import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const CALCULATIONS_LIST_CONTRACT = {
  sortableColumns: ["createdAt"] as const,
  defaultSort: { id: "createdAt" as const, desc: true },
  filters: {
    applicationId: {
      kind: "number" as const,
      cardinality: "single" as const,
      int: true,
    },
    status: {
      kind: "string" as const,
      cardinality: "single" as const,
      enumValues: ["draft", "active"] as const,
    },
  },
} satisfies ListQueryContract<readonly ["createdAt"], any>;

export const ListCalculationsQuerySchema = createListQuerySchemaFromContract(
  CALCULATIONS_LIST_CONTRACT,
);

export type ListCalculationsQuery = z.infer<
  typeof ListCalculationsQuerySchema
>;
