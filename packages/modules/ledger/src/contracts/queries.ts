import type { z } from "zod";

import type { ListLedgerOperationsInputSchema } from "./zod";

export type ListLedgerOperationsInput = z.input<
  typeof ListLedgerOperationsInputSchema
>;
export type ResolvedListLedgerOperationsInput = z.output<
  typeof ListLedgerOperationsInputSchema
>;

export interface ListScopedPostingRowsInput {
  statuses: ("pending" | "posted" | "failed")[];
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
