import { eq } from "drizzle-orm";

import { OrganizationNotFoundError } from "../errors";
import type { OrganizationsServiceContext } from "../internal/context";
import { schema } from "../schema";
import type { Organization } from "../validation";

export function createFindOrganizationByIdHandler(
  context: OrganizationsServiceContext,
) {
  const { db } = context;

  return async function findOrganizationById(id: string): Promise<Organization> {
    const [row] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, id))
      .limit(1);

    if (!row) {
      throw new OrganizationNotFoundError(id);
    }

    return row;
  };
}
