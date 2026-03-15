import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  ListOrganizationsQuery,
  Organization,
} from "../../contracts";
import type { OrganizationSnapshot } from "../../domain/organization";

export interface OrganizationsQueryRepository {
  findOrganizationById: (id: string) => Promise<Organization | null>;
  listOrganizations: (
    input: ListOrganizationsQuery,
  ) => Promise<PaginatedList<Organization>>;
  listInternalLedgerOrganizations: () => Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
  listExistingOrganizationIds: (ids: string[]) => Promise<string[]>;
}

export interface OrganizationsCommandRepository {
  findOrganizationSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<OrganizationSnapshot | null>;
  insertOrganizationTx: (
    tx: Transaction,
    organization: OrganizationSnapshot,
  ) => Promise<OrganizationSnapshot>;
  updateOrganizationTx: (
    tx: Transaction,
    organization: OrganizationSnapshot,
  ) => Promise<OrganizationSnapshot | null>;
  removeOrganizationTx: (tx: Transaction, id: string) => Promise<boolean>;
}
