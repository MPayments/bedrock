import { eq } from "drizzle-orm";

import { OrganizationDeleteConflictError, OrganizationNotFoundError } from "../errors";
import type { OrganizationsServiceContext } from "../internal/context";
import { schema } from "../schema";

function hasForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23503") {
    return true;
  }

  return hasForeignKeyViolation(candidate.cause);
}

export function createRemoveOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { db, log } = context;

  return async function removeOrganization(id: string): Promise<void> {
    try {
      const [deleted] = await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, id))
        .returning({ id: schema.organizations.id });

      if (!deleted) {
        throw new OrganizationNotFoundError(id);
      }
    } catch (error) {
      if (error instanceof OrganizationNotFoundError) {
        throw error;
      }

      if (hasForeignKeyViolation(error)) {
        throw new OrganizationDeleteConflictError(id);
      }

      throw error;
    }

    log.info("Organization deleted", { id });
  };
}
