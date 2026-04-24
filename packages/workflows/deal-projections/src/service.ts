import { listCrmDealBoard } from "./crm/board";
import {
  getCrmDealsStats,
  listCrmDeals,
  listCrmDealsByDay,
  listCrmDealsByStatus,
} from "./crm/list";
import { getCrmDealWorkbenchProjection } from "./crm/workbench";
import { listFinanceDealQueues } from "./finance/queue";
import { getFinanceDealWorkspaceProjection } from "./finance/workspace";
import {
  getPortalDealProjection,
  listPortalDeals,
} from "./portal/handlers";
import type { DealProjectionsWorkflowDeps } from "./shared/deps";

export type { DealProjectionsWorkflowDeps } from "./shared/deps";
export type { ListFinanceDealQueuesInput } from "./finance/queue";

export function createDealProjectionsWorkflow(
  deps: DealProjectionsWorkflowDeps,
) {
  return {
    getCrmDealWorkbenchProjection: (dealId: string) =>
      getCrmDealWorkbenchProjection(deps, dealId),
    getCrmDealsStats: (input: Parameters<typeof getCrmDealsStats>[1]) =>
      getCrmDealsStats(deps, input),
    getFinanceDealWorkspaceProjection: (dealId: string) =>
      getFinanceDealWorkspaceProjection(deps, dealId),
    getPortalDealProjection: (dealId: string, customerId: string) =>
      getPortalDealProjection(deps, dealId, customerId),
    listCrmDealBoard: () => listCrmDealBoard(deps),
    listCrmDeals: (query?: Parameters<typeof listCrmDeals>[1]) =>
      listCrmDeals(deps, query),
    listCrmDealsByDay: (query?: Parameters<typeof listCrmDealsByDay>[1]) =>
      listCrmDealsByDay(deps, query),
    listCrmDealsByStatus: () => listCrmDealsByStatus(deps),
    listFinanceDealQueues: (
      filters?: Parameters<typeof listFinanceDealQueues>[1],
    ) => listFinanceDealQueues(deps, filters),
    listPortalDeals: (customerId: string, limit?: number, offset?: number) =>
      listPortalDeals(deps, customerId, limit, offset),
  };
}

export type DealProjectionsWorkflow = ReturnType<
  typeof createDealProjectionsWorkflow
>;
