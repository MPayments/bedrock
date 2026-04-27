import type {
  PortalDealListProjection,
  PortalDealProjection,
} from "../contracts";
import {
  buildPortalProjection,
  isDealOwnedByCustomer,
  toPortalListItem,
} from "./builders";
import type { DealProjectionsWorkflowDeps } from "../shared/deps";

type PortalDeps = Pick<
  DealProjectionsWorkflowDeps,
  "currencies" | "deals" | "files"
>;

export async function getPortalDealProjection(
  deps: PortalDeps,
  dealId: string,
  customerId: string,
): Promise<PortalDealProjection | null> {
  const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

  if (!workflow || !isDealOwnedByCustomer(workflow, customerId)) {
    return null;
  }

  const attachments =
    await deps.files.files.queries.listDealAttachments(dealId);
  return buildPortalProjection({ attachments, workflow }, deps);
}

export async function listPortalDeals(
  deps: PortalDeps,
  customerId: string,
  limit = 20,
  offset = 0,
): Promise<PortalDealListProjection> {
  const deals = await deps.deals.deals.queries.list({
    customerId,
    limit,
    offset,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const projections = await Promise.all(
    deals.data.map((deal) =>
      getPortalDealProjection(deps, deal.id, customerId),
    ),
  );

  return {
    data: projections
      .filter(
        (projection): projection is PortalDealProjection =>
          projection !== null,
      )
      .map(toPortalListItem),
    limit: deals.limit,
    offset: deals.offset,
    total: deals.total,
  };
}
