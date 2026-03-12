import { eq, sql } from "drizzle-orm";

import { OrganizationNotFoundError } from "../errors";
import type { OrganizationsServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  UpdateOrganizationInputSchema,
  type Organization,
  type UpdateOrganizationInput,
} from "../validation";

export function createUpdateOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { db, log } = context;

  return async function updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization> {
    const validated = UpdateOrganizationInputSchema.parse(input);

    const [existing] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, id))
      .limit(1);

    if (!existing) {
      throw new OrganizationNotFoundError(id);
    }

    const fields: Record<string, unknown> = {};
    if (validated.shortName !== undefined) fields.shortName = validated.shortName;
    if (validated.fullName !== undefined) fields.fullName = validated.fullName;
    if (validated.kind !== undefined) fields.kind = validated.kind;
    if (validated.country !== undefined) fields.country = validated.country;
    if (validated.externalId !== undefined) fields.externalId = validated.externalId;
    if (validated.description !== undefined) {
      fields.description = validated.description;
    }

    if (Object.keys(fields).length === 0) {
      return existing;
    }

    fields.updatedAt = sql`now()`;

    const [updated] = await db
      .update(schema.organizations)
      .set(fields)
      .where(eq(schema.organizations.id, id))
      .returning();

    if (!updated) {
      throw new OrganizationNotFoundError(id);
    }

    log.info("Organization updated", { id });

    return updated;
  };
}
