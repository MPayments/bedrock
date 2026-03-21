import type { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import { USER_ROLE_VALUES } from "../domain/user-role";

const USERS_SORTABLE_COLUMNS = ["name", "email", "role", "createdAt"] as const;

interface UsersListFilters {
  name: { kind: "string"; cardinality: "single" };
  email: { kind: "string"; cardinality: "single" };
  role: {
    kind: "string";
    cardinality: "multi";
    enumValues: typeof USER_ROLE_VALUES;
  };
  banned: { kind: "boolean"; cardinality: "single" };
}

export const USERS_LIST_CONTRACT: ListQueryContract<
  typeof USERS_SORTABLE_COLUMNS,
  UsersListFilters
> = {
  sortableColumns: USERS_SORTABLE_COLUMNS,
  defaultSort: { id: "createdAt", desc: true },
  filters: {
    name: { kind: "string", cardinality: "single" },
    email: { kind: "string", cardinality: "single" },
    role: {
      kind: "string",
      cardinality: "multi",
      enumValues: USER_ROLE_VALUES,
    },
    banned: { kind: "boolean", cardinality: "single" },
  },
};

export const ListUsersQuerySchema =
  createListQuerySchemaFromContract(USERS_LIST_CONTRACT);

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
