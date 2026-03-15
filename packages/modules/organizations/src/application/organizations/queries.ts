import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  ListOrganizationsQuerySchema,
  type ListOrganizationsQuery,
  type Organization,
} from "../../contracts";
import { OrganizationNotFoundError } from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";

export function createListOrganizationsHandler(
  context: OrganizationsServiceContext,
) {
  const { organizationQueries } = context;

  return async function listOrganizations(
    input?: ListOrganizationsQuery,
  ): Promise<PaginatedList<Organization>> {
    const query = ListOrganizationsQuerySchema.parse(input ?? {});
    return organizationQueries.listOrganizations(query);
  };
}

export function createFindOrganizationByIdHandler(
  context: OrganizationsServiceContext,
) {
  const { organizationQueries } = context;

  return async function findOrganizationById(id: string): Promise<Organization> {
    const organization = await organizationQueries.findOrganizationById(id);

    if (!organization) {
      throw new OrganizationNotFoundError(id);
    }

    return organization;
  };
}
