import type { LedgerReportingPort } from "./ports";
import type { LedgerReadPort } from "../operations/ports";

export interface LedgerQueries
  extends Pick<LedgerReadPort, "getOperationDetails" | "listOperations">,
    LedgerReportingPort {}

export function createLedgerReportingQueries(input: {
  reads: LedgerReadPort;
  reporting: LedgerReportingPort;
}): LedgerQueries {
  return {
    getOperationDetails: input.reads.getOperationDetails,
    listOperations: input.reads.listOperations,
    listBooksById: input.reporting.listBooksById,
    listBooksByOwnerId: input.reporting.listBooksByOwnerId,
    listScopedPostingRows: input.reporting.listScopedPostingRows,
  };
}
