import type { Organization } from "../../../contracts";
import { OrganizationNotFoundError } from "../../../errors";
import type { OrganizationsServiceContext } from "../../shared/context";

export function createFindOrganizationByIdHandler(
  context: OrganizationsServiceContext,
) {
  const { organizations } = context;

  return async function findOrganizationById(id: string): Promise<Organization> {
    const organization = await organizations.findOrganizationById(id);

    if (!organization) {
      throw new OrganizationNotFoundError(id);
    }

    return organization;
  };
}
