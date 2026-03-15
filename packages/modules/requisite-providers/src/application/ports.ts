import type { Queryable } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  CreateRequisiteProviderInput,
  ListRequisiteProvidersQuery,
  RequisiteProvider,
  UpdateRequisiteProviderInput,
} from "../contracts";

export interface RequisiteProvidersRepository {
  findProviderById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider | null>;
  findActiveProviderById: (
    id: string,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider | null>;
  listProviders: (
    input: ListRequisiteProvidersQuery,
    queryable?: Queryable,
  ) => Promise<PaginatedList<RequisiteProvider>>;
  insertProvider: (
    input: CreateRequisiteProviderInput,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider>;
  updateProvider: (
    id: string,
    input: UpdateRequisiteProviderInput,
    queryable?: Queryable,
  ) => Promise<RequisiteProvider | null>;
  archiveProvider: (id: string, queryable?: Queryable) => Promise<boolean>;
}
