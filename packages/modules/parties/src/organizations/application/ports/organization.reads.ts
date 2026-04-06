import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Organization, OrganizationListItem } from "../contracts/dto";
import type { ListOrganizationsQuery } from "../contracts/queries";

export interface OrganizationReads {
  findById(id: string): Promise<Organization | null>;
  list(query: ListOrganizationsQuery): Promise<PaginatedList<OrganizationListItem>>;
  listInternalLedgerOrganizations(): Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  listExistingOrganizationIds(ids: string[]): Promise<string[]>;
}
