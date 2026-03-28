import type { TreasuryCoreServiceDeps } from "../../shared/application/core-context";
import { createTreasuryCoreServiceContext } from "../../shared/application/core-context";
import { ApproveOperationCommand } from "./commands/approve-operation";
import { IssueOperationCommand } from "./commands/issue-operation";
import { ReserveOperationFundsCommand } from "./commands/reserve-operation-funds";
import { GetOperationTimelineQuery } from "./queries/get-operation-timeline";
import { ListTreasuryOperationsQuery } from "./queries/list-treasury-operations";
import { ListOperationDocumentLinksQuery } from "./queries/list-operation-document-links";

export function createTreasuryOperationsService(
  deps: TreasuryCoreServiceDeps,
) {
  const context = createTreasuryCoreServiceContext(deps);

  const approveOperation = new ApproveOperationCommand(context);
  const issueOperation = new IssueOperationCommand(context);
  const reserveOperationFunds = new ReserveOperationFundsCommand(context);
  const getOperationTimeline = new GetOperationTimelineQuery(context);
  const listOperationDocumentLinks = new ListOperationDocumentLinksQuery(context);
  const listTreasuryOperations = new ListTreasuryOperationsQuery(context);

  return {
    commands: {
      approveOperation: approveOperation.execute.bind(approveOperation),
      issueOperation: issueOperation.execute.bind(issueOperation),
      reserveOperationFunds:
        reserveOperationFunds.execute.bind(reserveOperationFunds),
    },
    queries: {
      getOperationTimeline:
        getOperationTimeline.execute.bind(getOperationTimeline),
      listOperationDocumentLinks:
        listOperationDocumentLinks.execute.bind(listOperationDocumentLinks),
      listTreasuryOperations:
        listTreasuryOperations.execute.bind(listTreasuryOperations),
    },
  };
}

export type TreasuryOperationsService = ReturnType<
  typeof createTreasuryOperationsService
>;
