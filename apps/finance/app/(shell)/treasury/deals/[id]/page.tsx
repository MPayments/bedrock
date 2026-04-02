import { FinanceDealWorkbench } from "@/features/treasury/deals/components/workbench";
import { getFinanceDealWorkbenchById } from "@/features/treasury/deals/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryDealWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryDealWorkspacePage({
  params,
}: TreasuryDealWorkspacePageProps) {
  const { entity: deal } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getFinanceDealWorkbenchById,
  });

  return <FinanceDealWorkbench deal={deal} />;
}
