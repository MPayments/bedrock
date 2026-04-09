import { invariant } from "@bedrock/shared/core/domain";

export interface RequisiteProviderBranchSelection {
  id: string;
  branches?: { id: string }[] | null;
}

export function assertRequisiteProviderBranchSelection(
  provider: RequisiteProviderBranchSelection,
  branchId: string | null,
) {
  if (!branchId) {
    return;
  }

  invariant(
    (provider.branches ?? []).some((branch) => branch.id === branchId),
    `Requisite provider branch ${branchId} does not belong to provider ${provider.id}`,
    {
      code: "requisite_provider.branch.provider_mismatch",
      meta: {
        branchId,
        providerId: provider.id,
      },
    },
  );
}
