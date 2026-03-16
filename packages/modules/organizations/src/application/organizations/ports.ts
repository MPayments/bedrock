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

export interface OrganizationsCommandTxRepository {
  findOrganizationSnapshotById: (
    id: string,
  ) => Promise<OrganizationSnapshot | null>;
  insertOrganization: (
    organization: OrganizationSnapshot,
  ) => Promise<OrganizationSnapshot>;
  updateOrganization: (
    organization: OrganizationSnapshot,
  ) => Promise<OrganizationSnapshot | null>;
  removeOrganization: (id: string) => Promise<boolean>;
}
