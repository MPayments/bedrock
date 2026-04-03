import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

const SUB_AGENT_PROFILES_SORTABLE_COLUMNS = [
  "shortName",
  "fullName",
  "commissionRate",
  "createdAt",
  "updatedAt",
] as const;

export const SUB_AGENT_PROFILES_LIST_CONTRACT = {
  sortableColumns: SUB_AGENT_PROFILES_SORTABLE_COLUMNS,
  defaultSort: { id: "shortName" as const, desc: false },
  filters: {
    shortName: { kind: "string" as const, cardinality: "single" as const },
    fullName: { kind: "string" as const, cardinality: "single" as const },
    country: { kind: "string" as const, cardinality: "multi" as const },
    kind: { kind: "string" as const, cardinality: "multi" as const },
    isActive: { kind: "boolean" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<typeof SUB_AGENT_PROFILES_SORTABLE_COLUMNS, any>;

export const ListSubAgentProfilesQuerySchema =
  createListQuerySchemaFromContract(SUB_AGENT_PROFILES_LIST_CONTRACT);

export type ListSubAgentProfilesQuery = z.infer<
  typeof ListSubAgentProfilesQuerySchema
>;
