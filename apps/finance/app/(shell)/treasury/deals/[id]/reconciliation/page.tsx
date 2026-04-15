import { ReconciliationWorkspace } from "@/features/treasury/deals/components/reconciliation-workspace";
import { getFinanceDealReconciliationWorkspaceById } from "@/features/treasury/deals/lib/reconciliation-workspace";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryDealReconciliationPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryDealReconciliationPage({
  params,
}: TreasuryDealReconciliationPageProps) {
  const { entity } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getFinanceDealReconciliationWorkspaceById,
  });

  return <ReconciliationWorkspace data={entity} />;
}
