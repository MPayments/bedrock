import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Organization } from "../contracts/dto";
import type { ListOrganizationsQuery } from "../contracts/queries";

export interface OrganizationReads {
  findById(id: number): Promise<Organization | null>;
  findByName(name: string): Promise<Organization | null>;
  list(input: ListOrganizationsQuery): Promise<PaginatedList<Organization>>;
}
