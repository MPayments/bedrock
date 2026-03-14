import {
  UpdateOrganizationInputSchema,
  type Organization,
  type UpdateOrganizationInput,
} from "../../../contracts";
import { OrganizationNotFoundError } from "../../../errors";
import type { OrganizationsServiceContext } from "../../shared/context";

export function createUpdateOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { log, organizations } = context;

  return async function updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization> {
    const existing = await organizations.findOrganizationById(id);

    if (!existing) {
      throw new OrganizationNotFoundError(id);
    }

    const validated = UpdateOrganizationInputSchema.parse(input);
    const updated = await organizations.updateOrganization(id, validated);

    if (!updated) {
      throw new OrganizationNotFoundError(id);
    }

    log.info("Organization updated", { id });

    return updated;
  };
}
