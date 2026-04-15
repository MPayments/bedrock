import { ExecutionWorkspace } from "@/features/treasury/deals/components/execution-workspace";
import { getFinanceDealExecutionWorkspaceById } from "@/features/treasury/deals/lib/execution-workspace";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryDealExecutionPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryDealExecutionPage({
  params,
}: TreasuryDealExecutionPageProps) {
  const { entity } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getFinanceDealExecutionWorkspaceById,
  });

  return <ExecutionWorkspace data={entity} />;
}
