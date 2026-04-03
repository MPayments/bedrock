import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { RequisiteProvider } from "../contracts/dto";
import type { ListRequisiteProvidersQuery } from "../contracts/queries";

export interface RequisiteProviderReads {
  findById(id: string): Promise<RequisiteProvider | null>;
  findActiveById(id: string): Promise<RequisiteProvider | null>;
  list(
    query: ListRequisiteProvidersQuery,
  ): Promise<PaginatedList<RequisiteProvider>>;
}
