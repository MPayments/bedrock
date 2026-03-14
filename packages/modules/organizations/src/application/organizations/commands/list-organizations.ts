import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  ListOrganizationsQuerySchema,
  type ListOrganizationsQuery,
  type Organization,
} from "../../../contracts";
import type { OrganizationsServiceContext } from "../../shared/context";

export function createListOrganizationsHandler(
  context: OrganizationsServiceContext,
) {
  const { organizations } = context;

  return async function listOrganizations(
    input?: ListOrganizationsQuery,
  ): Promise<PaginatedList<Organization>> {
    const query = ListOrganizationsQuerySchema.parse(input ?? {});
    return organizations.listOrganizations(query);
  };
}
