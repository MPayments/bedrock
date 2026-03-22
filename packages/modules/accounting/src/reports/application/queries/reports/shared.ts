import {
  normalizeReportCurrency,
  type FinancialResultStatus,
  type ReportAttributionMode,
  type ReportScopeMeta,
  type ReportScopeType,
  type ResolvedScope,
  type ScopedPosting,
} from "../../../domain";
import type { AccountingReportsContext } from "../../ports";

interface ReportScopeQueryInput {
  scopeType: ReportScopeType;
  counterpartyId: string[];
  groupId: string[];
  bookId: string[];
  includeDescendants: boolean;
}

interface ScopedPostingsQueryInput extends ReportScopeQueryInput {
  attributionMode: ReportAttributionMode;
  includeUnattributed: boolean;
  currency?: string;
  status: readonly string[];
}

export function buildReportScopeMeta(
  context: AccountingReportsContext,
  input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    hasUnattributedData: boolean;
  },
): ReportScopeMeta {
  return context.buildScopeMeta(input);
}

export async function resolveReportScope(
  context: AccountingReportsContext,
  query: ReportScopeQueryInput,
): Promise<ResolvedScope> {
  return context.resolveScope({
    scopeType: query.scopeType,
    counterpartyIds: query.counterpartyId,
    groupIds: query.groupId,
    bookIds: query.bookId,
    includeDescendants: query.includeDescendants,
  });
}

export async function fetchScopedReportPostings(
  context: AccountingReportsContext,
  input: {
    query: ScopedPostingsQueryInput;
    from?: Date;
    to?: Date;
    asOf?: Date;
  },
): Promise<{
  scope: ResolvedScope;
  postings: ScopedPosting[];
  scopeMeta: ReportScopeMeta;
}> {
  const scope = await resolveReportScope(context, input.query);
  const postings = await context.fetchScopedPostings({
    scope,
    attributionMode: input.query.attributionMode,
    statuses: input.query.status as FinancialResultStatus[],
    from: input.from,
    to: input.to,
    asOf: input.asOf,
    currency: normalizeReportCurrency(input.query.currency),
    includeUnattributed: input.query.includeUnattributed,
  });

  return {
    scope,
    postings,
    scopeMeta: buildReportScopeMeta(context, {
      scope,
      attributionMode: input.query.attributionMode,
      hasUnattributedData: postings.some(
        (posting) => posting.analyticCounterpartyId === null,
      ),
    }),
  };
}

export function sortRowsByContextParts<T>(
  context: AccountingReportsContext,
  rows: Iterable<T>,
  getParts: (row: T) => (string | null | undefined)[],
): T[] {
  return Array.from(rows).sort((left, right) =>
    context
      .keyByParts(...getParts(left))
      .localeCompare(context.keyByParts(...getParts(right))),
  );
}
