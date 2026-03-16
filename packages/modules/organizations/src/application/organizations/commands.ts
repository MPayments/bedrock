import { randomUUID } from "node:crypto";

import { resolveOrganizationUpdateInput } from "./inputs";
import type {
  CreateOrganizationInput,
  Organization as OrganizationDto,
  UpdateOrganizationInput,
} from "../../contracts";
import {
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
} from "../../contracts";
import { Organization } from "../../domain/organization";
import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
} from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";

function toPublicOrganization(organization: Organization): OrganizationDto {
  return organization.toSnapshot();
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

export function createCreateOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { log, transactions } = context;

  return async function createOrganization(
    input: CreateOrganizationInput,
  ): Promise<OrganizationDto> {
    const validated = CreateOrganizationInputSchema.parse(input);
    const draft = Organization.create(
      {
        id: randomUUID(),
        externalId: validated.externalId,
        shortName: validated.shortName,
        fullName: validated.fullName,
        description: validated.description,
        country: validated.country,
        kind: validated.kind,
      },
      context.now(),
    );

    return transactions.withTransaction(async ({ organizations }) => {
      const created = Organization.fromSnapshot(
        await organizations.insertOrganization(draft.toSnapshot()),
      );

      log.info("Organization created", {
        id: created.id,
        shortName: created.toSnapshot().shortName,
      });

      return toPublicOrganization(created);
    });
  };
}

export function createUpdateOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { log, transactions } = context;

  return async function updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationDto> {
    const validated = UpdateOrganizationInputSchema.parse(input);

    return transactions.withTransaction(async ({ organizations }) => {
      const existingSnapshot =
        await organizations.findOrganizationSnapshotById(id);

      if (!existingSnapshot) {
        throw new OrganizationNotFoundError(id);
      }

      const existing = Organization.fromSnapshot(existingSnapshot);
      const next = existing.update(
        resolveOrganizationUpdateInput(existing.toSnapshot(), validated),
        context.now(),
      );
      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await organizations.updateOrganization(next.toSnapshot());

      if (!persistedSnapshot) {
        throw new OrganizationNotFoundError(id);
      }

      log.info("Organization updated", { id });
      return toPublicOrganization(Organization.fromSnapshot(persistedSnapshot));
    });
  };
}

export function createRemoveOrganizationHandler(
  context: OrganizationsServiceContext,
) {
  const { log, transactions } = context;

  return async function removeOrganization(id: string): Promise<void> {
    try {
      await transactions.withTransaction(async ({ organizations }) => {
        const deleted = await organizations.removeOrganization(id);

        if (!deleted) {
          throw new OrganizationNotFoundError(id);
        }
      });
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
