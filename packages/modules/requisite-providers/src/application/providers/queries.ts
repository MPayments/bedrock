import {
  ListRequisiteProvidersQuerySchema,
  type ListRequisiteProvidersQuery,
} from "../../contracts";
import {
  RequisiteProviderNotActiveError,
  RequisiteProviderNotFoundError,
} from "../../errors";
import type { RequisiteProvidersServiceContext } from "../shared/context";

export function createListRequisiteProvidersHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { queries } = context;

  return async function listRequisiteProviders(
    input?: ListRequisiteProvidersQuery,
  ) {
    const query = ListRequisiteProvidersQuerySchema.parse(input ?? {});
    return queries.listProviders(query);
  };
}

export function createFindRequisiteProviderByIdHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { queries } = context;

  return async function findRequisiteProviderById(id: string) {
    const provider = await queries.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotFoundError(id);
    }

    return provider;
  };
}

export function createAssertActiveRequisiteProviderHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { queries } = context;

  return async function assertActiveRequisiteProvider(id: string) {
    const provider = await queries.findActiveProviderById(id);

    if (!provider) {
      throw new RequisiteProviderNotActiveError(id);
    }

    return provider;
  };
}
