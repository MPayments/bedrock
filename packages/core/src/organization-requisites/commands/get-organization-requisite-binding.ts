import { eq } from "drizzle-orm";

import { schema } from "../schema";
import {
  OrganizationRequisiteBindingNotFoundError,
  OrganizationRequisiteNotFoundError,
} from "../errors";
import type { OrganizationRequisitesServiceContext } from "../internal/context";

export function createGetOrganizationRequisiteBindingHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db } = context;

  return async function getOrganizationRequisiteBinding(requisiteId: string) {
    const [requisite] = await db
      .select({ id: schema.organizationRequisites.id })
      .from(schema.organizationRequisites)
      .where(eq(schema.organizationRequisites.id, requisiteId))
      .limit(1);

    if (!requisite) {
      throw new OrganizationRequisiteNotFoundError(requisiteId);
    }

    const [binding] = await db
      .select()
      .from(schema.organizationRequisiteBindings)
      .where(eq(schema.organizationRequisiteBindings.requisiteId, requisiteId))
      .limit(1);

    if (!binding) {
      throw new OrganizationRequisiteBindingNotFoundError(requisiteId);
    }

    return binding;
  };
}
