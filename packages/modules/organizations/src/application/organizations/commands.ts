import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  CreateOrganizationInputSchema,
  ListOrganizationsQuerySchema,
  UpdateOrganizationInputSchema,
  type CreateOrganizationInput,
  type ListOrganizationsQuery,
  type Organization,
  type UpdateOrganizationInput,
} from "../../contracts";
import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
} from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";

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

export function createListOrganizationsHandler(
  context: OrganizationsServiceContext,
) {
  const { organizations } = context;

  return async function listOrganizations(
    input?: ListOrganizationsQuery,
  ): Promise<PaginatedList<Organization>> {
    const query = ListOrganizationsQuerySchema.parse(input ?? {});
    return organizations.listOrganizations(query);
  };
}

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
  const { log, organizations } = context;

  return async function removeOrganization(id: string): Promise<void> {
    try {
      const deleted = await organizations.removeOrganization(id);

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
