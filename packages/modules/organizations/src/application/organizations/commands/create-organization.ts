import {
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
  type Organization,
} from "../../../contracts";
import type { OrganizationsServiceContext } from "../../shared/context";

export function createCreateOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { db, ledgerBooks, log, organizations } = context;

  return async function createOrganization(
    input: CreateOrganizationInput,
  ): Promise<Organization> {
    const validated = CreateOrganizationInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const created = await organizations.insertOrganizationTx(tx, validated);

      await ledgerBooks.ensureDefaultOrganizationBook(tx, {
        organizationId: created.id,
      });

      log.info("Organization created", {
        id: created.id,
        shortName: created.shortName,
      });

      return created;
    });
  };
}
