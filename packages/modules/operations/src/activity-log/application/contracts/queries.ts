import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import { ACTIVITY_ACTION_VALUES, ACTIVITY_ENTITY_VALUES } from "./commands";

export const ACTIVITY_LOG_LIST_CONTRACT = {
  sortableColumns: ["createdAt"] as const,
  defaultSort: { id: "createdAt" as const, desc: true },
  filters: {
    userId: { kind: "string" as const, cardinality: "single" as const },
    action: {
      kind: "string" as const,
      cardinality: "single" as const,
      enumValues: ACTIVITY_ACTION_VALUES,
    },
    entityType: {
      kind: "string" as const,
      cardinality: "single" as const,
      enumValues: ACTIVITY_ENTITY_VALUES,
    },
    entityId: { kind: "number" as const, cardinality: "single" as const, int: true },
    isAdmin: { kind: "boolean" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<readonly ["createdAt"], any>;

export const ListActivitiesQuerySchema = createListQuerySchemaFromContract(
  ACTIVITY_LOG_LIST_CONTRACT,
);

export type ListActivitiesQuery = z.infer<typeof ListActivitiesQuerySchema>;
