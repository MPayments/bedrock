import { and, eq, isNull } from "drizzle-orm";

import { schema } from "../schema";
import { OrganizationRequisiteNotFoundError } from "../errors";
import type { OrganizationRequisitesServiceContext } from "../internal/context";

export function createFindOrganizationRequisiteByIdHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db } = context;

  return async function findOrganizationRequisiteById(id: string) {
    const [requisite] = await db
      .select()
      .from(schema.organizationRequisites)
      .where(
        and(
          eq(schema.organizationRequisites.id, id),
          isNull(schema.organizationRequisites.archivedAt),
        ),
      )
      .limit(1);

    if (!requisite) {
      throw new OrganizationRequisiteNotFoundError(id);
    }

    return requisite;
  };
}
