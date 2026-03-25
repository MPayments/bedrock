import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

export const ORGANIZATIONS_LIST_CONTRACT = {
  sortableColumns: ["name", "createdAt"] as const,
  defaultSort: { id: "name" as const, desc: false },
  filters: {
    name: { kind: "string" as const, cardinality: "single" as const },
    isActive: { kind: "boolean" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<readonly ["name", "createdAt"], any>;

export const ListOrganizationsQuerySchema =
  createListQuerySchemaFromContract(ORGANIZATIONS_LIST_CONTRACT);

export type ListOrganizationsQuery = z.infer<
  typeof ListOrganizationsQuerySchema
>;
