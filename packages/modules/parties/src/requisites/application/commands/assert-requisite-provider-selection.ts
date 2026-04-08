import type { RequisiteProviderReads } from "../ports/requisite-provider.reads";
import {
  RequisiteProviderBranchMismatchError,
  RequisiteProviderNotActiveError,
} from "../errors";

export async function assertRequisiteProviderSelection(
  reads: RequisiteProviderReads,
  providerId: string,
  providerBranchId: string | null,
) {
  const provider = await reads.findActiveById(providerId);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
  }

  if (
    providerBranchId &&
    !(provider.branches ?? []).some((branch) => branch.id === providerBranchId)
  ) {
    throw new RequisiteProviderBranchMismatchError(
      providerId,
      providerBranchId,
    );
  }
}
