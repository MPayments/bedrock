export type ReportScopeType = "all" | "counterparty" | "group" | "book";
export type ReportAttributionMode = "analytic_counterparty" | "book_org";

export interface ReportScopeMeta {
  scopeType: ReportScopeType;
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIdsCount: number;
  attributionMode: ReportAttributionMode;
  hasUnattributedData: boolean;
}

export interface ResolvedScope {
  scopeType: ReportScopeType;
  requestedCounterpartyIds: string[];
  requestedGroupIds: string[];
  requestedBookIds: string[];
  resolvedCounterpartyIds: string[];
  resolvedBookIds: string[];
}
