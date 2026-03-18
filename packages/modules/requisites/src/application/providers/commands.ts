import { randomUUID } from "node:crypto";

import {
  CreateRequisiteProviderInputSchema,
  UpdateRequisiteProviderInputSchema,
  type CreateRequisiteProviderInput,
  type UpdateRequisiteProviderInput,
} from "../../contracts";
import { RequisiteProvider } from "../../domain/requisite-provider";
import { RequisiteProviderNotFoundError } from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

export function createCreateRequisiteProviderHandler(
  context: RequisitesServiceContext,
) {
  const { log, now, providerCommands } = context;

  return async function createRequisiteProvider(
    input: CreateRequisiteProviderInput,
  ) {
    const validated = CreateRequisiteProviderInputSchema.parse(input);
    const provider = RequisiteProvider.create({
      id: randomUUID(),
      now: now(),
      ...validated,
    });
    const created = await providerCommands.insertProvider(provider.toSnapshot());

    log.info("Requisite provider created", {
      id: created.id,
      name: created.name,
    });

    return created;
  };
}

export function createUpdateRequisiteProviderHandler(
  context: RequisitesServiceContext,
) {
  const { log, now, providerQueries, providerCommands } = context;

  return async function updateRequisiteProvider(
    id: string,
    input: UpdateRequisiteProviderInput,
  ) {
    const validated = UpdateRequisiteProviderInputSchema.parse(input);
    const existing = await providerQueries.findActiveProviderById(id);

    if (!existing) {
      throw new RequisiteProviderNotFoundError(id);
    }

    const current = RequisiteProvider.fromSnapshot({
      ...existing,
    });
    const provider = current.update({
      ...validated,
      now: now(),
    });

    const updated = await providerCommands.updateProvider(provider.toSnapshot());

    if (!updated) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider updated", { id });
    return updated;
  };
}

export function createRemoveRequisiteProviderHandler(
  context: RequisitesServiceContext,
) {
  const { log, now, providerCommands } = context;

  return async function removeRequisiteProvider(id: string) {
    const removed = await providerCommands.archiveProvider(id, now());

    if (!removed) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider archived", { id });
  };
}
