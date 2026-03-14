import type { Transaction } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  Organization,
  UpdateOrganizationInput,
} from "../contracts";

export interface OrganizationsLedgerBooksPort {
  ensureDefaultOrganizationBook: (
    tx: Transaction,
    input: { organizationId: string },
  ) => Promise<{ bookId: string }>;
}

export interface OrganizationsLedgerReadPort {
  listBooksById: (
    bookIds: string[],
  ) => Promise<
    {
      id: string;
      ownerId: string | null;
    }[]
  >;
}

export interface OrganizationsRepository {
  insertOrganizationTx: (
    tx: Transaction,
    input: CreateOrganizationInput,
  ) => Promise<Organization>;
  findOrganizationById: (id: string) => Promise<Organization | null>;
  listOrganizations: (
    input: ListOrganizationsQuery,
  ) => Promise<PaginatedList<Organization>>;
  updateOrganization: (
    id: string,
    input: UpdateOrganizationInput,
  ) => Promise<Organization | null>;
  removeOrganization: (id: string) => Promise<boolean>;
  listInternalLedgerOrganizations: () => Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
  listExistingOrganizationIds: (ids: string[]) => Promise<string[]>;
}
