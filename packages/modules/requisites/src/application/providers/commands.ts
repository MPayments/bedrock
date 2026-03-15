import {
  CreateRequisiteProviderInputSchema,
  ListRequisiteProvidersQuerySchema,
  UpdateRequisiteProviderInputSchema,
  validateMergedRequisiteProviderState,
  type CreateRequisiteProviderInput,
  type ListRequisiteProvidersQuery,
  type UpdateRequisiteProviderInput,
} from "../../contracts";
import {
  RequisiteProviderNotFoundError,
} from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

export function createListRequisiteProvidersHandler(
  context: RequisitesServiceContext,
) {
  const { requisites } = context;

  return async function listRequisiteProviders(
    input?: ListRequisiteProvidersQuery,
  ) {
    const query = ListRequisiteProvidersQuerySchema.parse(input ?? {});
    return requisites.listProviders(query);
  };
}

export function createFindRequisiteProviderByIdHandler(
  context: RequisitesServiceContext,
) {
  const { requisites } = context;

  return async function findRequisiteProviderById(id: string) {
    const provider = await requisites.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotFoundError(id);
    }

    return provider;
  };
}

export function createCreateRequisiteProviderHandler(
  context: RequisitesServiceContext,
) {
  const { log, requisites } = context;

  return async function createRequisiteProvider(
    input: CreateRequisiteProviderInput,
  ) {
    const validated = CreateRequisiteProviderInputSchema.parse(input);
    const created = await requisites.insertProvider(validated);

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
  const { log, requisites } = context;

  return async function updateRequisiteProvider(
    id: string,
    input: UpdateRequisiteProviderInput,
  ) {
    const validated = UpdateRequisiteProviderInputSchema.parse(input);
    const existing = await requisites.findActiveProviderById(id);

    if (!existing) {
      throw new RequisiteProviderNotFoundError(id);
    }

    validateMergedRequisiteProviderState({
      kind: validated.kind ?? existing.kind,
      country: validated.country !== undefined ? validated.country : existing.country,
      bic: validated.bic !== undefined ? validated.bic : existing.bic,
      swift: validated.swift !== undefined ? validated.swift : existing.swift,
    });

    const updated = await requisites.updateProvider(id, validated);

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
  const { log, requisites } = context;

  return async function removeRequisiteProvider(id: string) {
    const removed = await requisites.archiveProvider(id);

    if (!removed) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider archived", { id });
  };
}
