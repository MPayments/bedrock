import {
  CreateRequisiteProviderInputSchema,
  ListRequisiteProvidersQuerySchema,
  UpdateRequisiteProviderInputSchema,
  type CreateRequisiteProviderInput,
  type ListRequisiteProvidersQuery,
  type UpdateRequisiteProviderInput,
} from "../../contracts";
import {
  RequisiteProviderNotActiveError,
  RequisiteProviderNotFoundError,
} from "../../errors";
import type { RequisiteProvidersServiceContext } from "../shared/context";

export function createListRequisiteProvidersHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { providers } = context;

  return async function listRequisiteProviders(
    input?: ListRequisiteProvidersQuery,
  ) {
    const query = ListRequisiteProvidersQuerySchema.parse(input ?? {});
    return providers.listProviders(query);
  };
}

export function createFindRequisiteProviderByIdHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { providers } = context;

  return async function findRequisiteProviderById(id: string) {
    const provider = await providers.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotFoundError(id);
    }

    return provider;
  };
}

export function createAssertActiveRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { providers } = context;

  return async function assertActiveRequisiteProvider(id: string) {
    const provider = await providers.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotActiveError(id);
    }

    return provider;
  };
}

export function createCreateRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { log, providers } = context;

  return async function createRequisiteProvider(
    input: CreateRequisiteProviderInput,
  ) {
    const validated = CreateRequisiteProviderInputSchema.parse(input);
    const created = await providers.insertProvider(validated);

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
  const { log, providers } = context;

  return async function updateRequisiteProvider(
    id: string,
    input: UpdateRequisiteProviderInput,
  ) {
    const validated = UpdateRequisiteProviderInputSchema.parse(input);
    const existing = await providers.findActiveProviderById(id);

    if (!existing) {
      throw new RequisiteProviderNotFoundError(id);
    }

    CreateRequisiteProviderInputSchema.parse({
      kind: validated.kind ?? existing.kind,
      name: validated.name ?? existing.name,
      description:
        validated.description !== undefined
          ? validated.description
          : existing.description,
      country:
        validated.country !== undefined ? validated.country : existing.country,
      address:
        validated.address !== undefined ? validated.address : existing.address,
      contact:
        validated.contact !== undefined ? validated.contact : existing.contact,
      bic: validated.bic !== undefined ? validated.bic : existing.bic,
      swift: validated.swift !== undefined ? validated.swift : existing.swift,
    });

    const updated = await providers.updateProvider(id, validated);

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
  const { log, providers } = context;

  return async function removeRequisiteProvider(id: string) {
    const removed = await providers.archiveProvider(id);

    if (!removed) {
      throw new RequisiteProviderNotFoundError(id);
    }

    log.info("Requisite provider archived", { id });
  };
}
