import { FinanceDealWorkspaceLayout } from "@/features/treasury/deals/components/workspace-layout";
import { FinanceDealWorkspaceView } from "@/features/treasury/deals/components/workspace-view";
import { getFinanceDealDisplayTitle } from "@/features/treasury/deals/labels";
import { getFinanceDealWorkspaceById } from "@/features/treasury/deals/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryDealWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryDealWorkspacePage({
  params,
}: TreasuryDealWorkspacePageProps) {
  const { entity: deal } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getFinanceDealWorkspaceById,
  });

  return (
    <FinanceDealWorkspaceLayout
      title={getFinanceDealDisplayTitle({
        applicantDisplayName: deal.summary.applicantDisplayName,
        id: deal.summary.id,
        type: deal.summary.type,
      })}
    >
      <FinanceDealWorkspaceView deal={deal} />
    </FinanceDealWorkspaceLayout>
  );
}

