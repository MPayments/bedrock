import { randomUUID } from "node:crypto";

import { applyPatch } from "@bedrock/shared/core";

import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "../../contracts";
import {
  CreateOrganizationInputSchema,
  UpdateOrganizationInputSchema,
} from "../../contracts";
import type { UpdateOrganizationProps } from "../../domain/organization";
import { Organization } from "../../domain/organization";
import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
} from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";


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
  ) {
    const validated = CreateOrganizationInputSchema.parse(input);
    const draft = Organization.create(
      {
        id: randomUUID(),
        ...validated,
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

      return created.toSnapshot();
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
  ) {
    const validated = UpdateOrganizationInputSchema.parse(input);

    return transactions.withTransaction(async ({ organizations }) => {
      const existingSnapshot =
        await organizations.findOrganizationSnapshotById(id);

      if (!existingSnapshot) {
        throw new OrganizationNotFoundError(id);
      }

      const existing = Organization.fromSnapshot(existingSnapshot);
      const current: UpdateOrganizationProps = existing.toSnapshot();
      const next = existing.update(
        applyPatch(current, validated),
        context.now(),
      );
      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await organizations.updateOrganization(next.toSnapshot());

      if (!persistedSnapshot) {
        throw new OrganizationNotFoundError(id);
      }

      log.info("Organization updated", { id });
      return Organization.fromSnapshot(persistedSnapshot).toSnapshot();
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
