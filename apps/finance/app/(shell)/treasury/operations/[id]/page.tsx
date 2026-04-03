import { TreasuryOperationDetailsView } from "@/features/treasury/operations/components/details";
import { getTreasuryOperationById } from "@/features/treasury/operations/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryOperationWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryOperationWorkspacePage({
  params,
}: TreasuryOperationWorkspacePageProps) {
  const { entity: operation } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getTreasuryOperationById,
  });

  return <TreasuryOperationDetailsView operation={operation} />;
}
