import { RouteComposerWorkspace } from "@/features/treasury/deals/components/route-composer";
import { getFinanceDealRouteComposerById } from "@/features/treasury/deals/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface TreasuryDealRouteComposerPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreasuryDealRouteComposerPage({
  params,
}: TreasuryDealRouteComposerPageProps) {
  const { entity } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getFinanceDealRouteComposerById,
  });

  return <RouteComposerWorkspace data={entity} />;
}
