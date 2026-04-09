import { assertRequisiteProviderBranchSelection } from "../../domain/requisite-provider-selection";
import {
  RequisiteProviderNotActiveError,
  rethrowRequisiteProviderDomainError,
} from "../errors";
import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";

export async function assertRequisiteProviderSelection(
  reads: RequisiteProviderReads,
  providerId: string,
  providerBranchId: string | null,
) {
  const provider = await reads.findActiveById(providerId);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
  }

  try {
    assertRequisiteProviderBranchSelection(provider, providerBranchId);
  } catch (error) {
    rethrowRequisiteProviderDomainError(error);
  }
}
