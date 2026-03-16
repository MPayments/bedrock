import {
  ListRequisiteProvidersQuerySchema,
  type ListRequisiteProvidersQuery,
} from "../../contracts";
import {
  RequisiteProviderNotActiveError,
  RequisiteProviderNotFoundError,
} from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

export function createListRequisiteProvidersHandler(
  context: RequisitesServiceContext,
) {
  const { providerQueries } = context;

  return async function listRequisiteProviders(
    input?: ListRequisiteProvidersQuery,
  ) {
    const query = ListRequisiteProvidersQuerySchema.parse(input ?? {});
    return providerQueries.listProviders(query);
  };
}

export function createFindRequisiteProviderByIdHandler(
  context: RequisitesServiceContext,
) {
  const { providerQueries } = context;

  return async function findRequisiteProviderById(id: string) {
    const provider = await providerQueries.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotFoundError(id);
    }

    return provider;
  };
}

export function createAssertActiveRequisiteProviderHandler(
  context: RequisitesServiceContext,
) {
  const { providerQueries } = context;

  return async function assertActiveRequisiteProvider(id: string) {
    const provider = await providerQueries.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotActiveError(id);
    }

    return provider;
  };
}
