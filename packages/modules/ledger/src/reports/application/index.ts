import type { LedgerReportsReads } from "./ports/reports.reads";
import { ListScopedPostingRowsQuery } from "./queries/list-scoped-posting-rows";

export interface ReportsServiceDeps {
  reads: LedgerReportsReads;
}

export function createReportsService(deps: ReportsServiceDeps) {
  const listScopedPostingRows = new ListScopedPostingRowsQuery(deps.reads);

  return {
    queries: {
      listScopedPostingRows:
        listScopedPostingRows.execute.bind(listScopedPostingRows),
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
