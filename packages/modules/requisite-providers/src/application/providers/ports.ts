import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  ListRequisiteProvidersQuery,
  RequisiteProvider,
} from "../../contracts";
import type { RequisiteProviderSnapshot } from "../../domain/requisite-provider";

export interface RequisiteProvidersQueryRepository {
  findProviderById(id: string): Promise<RequisiteProvider | null>;
  findActiveProviderById(id: string): Promise<RequisiteProvider | null>;
  listProviders(
    input: ListRequisiteProvidersQuery,
  ): Promise<PaginatedList<RequisiteProvider>>;
}

export interface RequisiteProvidersCommandRepository {
  insertProvider(
    snapshot: RequisiteProviderSnapshot,
    tx?: Transaction,
  ): Promise<RequisiteProvider>;
  updateProvider(
    snapshot: RequisiteProviderSnapshot,
    tx?: Transaction,
  ): Promise<RequisiteProvider | null>;
  archiveProvider(id: string, archivedAt: Date, tx?: Transaction): Promise<boolean>;
}
