import type { z } from "zod";

import { ListLedgerOperationsInputSchema } from "./zod";

export type ListLedgerOperationsInput = z.infer<
  typeof ListLedgerOperationsInputSchema
>;

export interface ListScopedPostingRowsInput {
  statuses: Array<"pending" | "posted" | "failed">;
  from?: Date;
  to?: Date;
  asOf?: Date;
  currency?: string;
  resolvedBookIds: string[];
  resolvedCounterpartyIds: string[];
  scopeType: "all" | "counterparty" | "group" | "book";
  attributionMode: "analytic_counterparty" | "book_org";
  includeUnattributed: boolean;
  internalLedgerOrganizationIds: string[];
}
