import type { OrganizationsServiceContext } from "../internal/context";
import { ensureOrganizationDefaultBookIdTx } from "../default-book";
import { schema } from "../schema";
import {
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
  type Organization,
} from "../validation";

export function createCreateOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { db, log } = context;

  return async function createOrganization(
    input: CreateOrganizationInput,
  ): Promise<Organization> {
    const validated = CreateOrganizationInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.organizations)
        .values({
          shortName: validated.shortName,
          fullName: validated.fullName,
          kind: validated.kind,
          country: validated.country ?? null,
          externalId: validated.externalId ?? null,
          description: validated.description ?? null,
        })
        .returning();

      await ensureOrganizationDefaultBookIdTx(tx, created!.id);

      log.info("Organization created", {
        id: created!.id,
        shortName: created!.shortName,
      });

      return created!;
    });
  };
}
