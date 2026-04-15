import { CalculationWorkspace } from "@/features/treasury/deals/components/calculation-workspace";
import { getFinanceDealCalculationWorkspaceById } from "@/features/treasury/deals/lib/calculation-workspace";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryDealCalculationPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryDealCalculationPage({
  params,
}: TreasuryDealCalculationPageProps) {
  const { entity } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getFinanceDealCalculationWorkspaceById,
  });

  return <CalculationWorkspace data={entity} />;
}
