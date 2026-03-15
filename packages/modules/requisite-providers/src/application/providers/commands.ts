import { randomUUID } from "node:crypto";

import {
  CreateRequisiteProviderInputSchema,
  UpdateRequisiteProviderInputSchema,
  type CreateRequisiteProviderInput,
  type UpdateRequisiteProviderInput,
} from "../../contracts";
import { RequisiteProvider } from "../../domain/requisite-provider";
import { RequisiteProviderNotFoundError } from "../../errors";
import type { RequisiteProvidersServiceContext } from "../shared/context";

export function createCreateRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { log, commands } = context;

  return async function createRequisiteProvider(
    input: CreateRequisiteProviderInput,
  ) {
    const validated = CreateRequisiteProviderInputSchema.parse(input);
    const provider = RequisiteProvider.create({
      id: randomUUID(),
      now: new Date(),
      ...validated,
    });
    const created = await commands.insertProvider(provider.toSnapshot());

    log.info("Requisite provider created", {
      id: created.id,
      name: created.name,
    });

    return created;
  };
}

export function createUpdateRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { log, queries, commands } = context;

  return async function updateRequisiteProvider(
    id: string,
    input: UpdateRequisiteProviderInput,
  ) {
    const validated = UpdateRequisiteProviderInputSchema.parse(input);
    const existing = await queries.findActiveProviderById(id);

    if (!existing) {
      throw new RequisiteProviderNotFoundError(id);
    }

    const provider = RequisiteProvider.reconstitute({
      ...existing,
    }).update({
      ...validated,
      now: new Date(),
    });

    const updated = await commands.updateProvider(provider.toSnapshot());

    if (!updated) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider updated", { id });
    return updated;
  };
}

export function createRemoveRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { log, commands } = context;

  return async function removeRequisiteProvider(id: string) {
    const removed = await commands.archiveProvider(id, new Date());

    if (!removed) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider archived", { id });
  };
}
