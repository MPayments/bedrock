
import type {
  AccountingScopedPostingRow,
  LedgerQueries,
} from "@bedrock/ledger/queries";
import type { OrganizationsQueries } from "@bedrock/organizations/queries";
import type { CounterpartiesQueries } from "@bedrock/parties/queries";
import { ValidationError } from "@bedrock/shared/core/errors";

import type { AccountingReportsDocumentsPort } from "../../../application/reports/ports";
import type {
  FinancialResultStatus,
  ReportAttributionMode,
  ReportScopeMeta,
  ReportScopeType,
  ResolvedScope,
  ScopedPosting,
} from "../../../domain/reports";
import { parseMinorAmount } from "../../../domain/reports";

export function createReportsScopeHelpers(input: {
  counterpartiesQueries: CounterpartiesQueries;
  documentsPort: AccountingReportsDocumentsPort;
  ledgerQueries: LedgerQueries;
  organizationsQueries: OrganizationsQueries;
}) {
  const {
    counterpartiesQueries,
    documentsPort,
    ledgerQueries,
    organizationsQueries,
  } = input;

  async function listInternalLedgerOrganizationIds(): Promise<string[]> {
    return organizationsQueries.listInternalLedgerOrganizationIds();
  }

  async function resolveScope(inputArgs: {
    scopeType: ReportScopeType;
    counterpartyIds: string[];
    groupIds: string[];
    bookIds: string[];
    includeDescendants: boolean;
  }): Promise<ResolvedScope> {
    const requestedCounterpartyIds = Array.from(
      new Set(inputArgs.counterpartyIds),
    );
    const requestedGroupIds = Array.from(new Set(inputArgs.groupIds));
    const requestedBookIds = Array.from(new Set(inputArgs.bookIds));

    if (inputArgs.scopeType === "all") {
      return {
        scopeType: inputArgs.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: [],
        resolvedBookIds: [],
      };
    }

    if (inputArgs.scopeType === "counterparty") {
      return {
        scopeType: inputArgs.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: requestedCounterpartyIds,
        resolvedBookIds: [],
      };
    }

    if (inputArgs.scopeType === "group") {
      const members = await counterpartiesQueries.listGroupMembers({
        groupIds: requestedGroupIds,
        includeDescendants: inputArgs.includeDescendants,
      });

      return {
        scopeType: inputArgs.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: Array.from(
          new Set(members.map((row) => row.counterpartyId)),
        ),
        resolvedBookIds: [],
      };
    }

    const bookRows =
      requestedBookIds.length === 0
        ? []
        : await ledgerQueries.listBooksById(requestedBookIds);

    const internalOrganizationIdSet = new Set(
      await organizationsQueries.listInternalLedgerOrganizationIds(),
    );
    const invalidBookIds = bookRows
      .filter(
        (row) =>
          !row.ownerId ||
          !internalOrganizationIdSet.has(row.ownerId),
      )
      .map((row) => row.id);
    if (invalidBookIds.length > 0) {
      throw new ValidationError(
        `book scope can include only internal-ledger books: ${invalidBookIds.join(", ")}`,
      );
    }

    return {
      scopeType: inputArgs.scopeType,
      requestedCounterpartyIds,
      requestedGroupIds,
      requestedBookIds,
      resolvedCounterpartyIds: Array.from(
        new Set(
          bookRows
            .map((row) => row.ownerId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
      resolvedBookIds: bookRows.map((row) => row.id),
    };
  }

  function buildScopeMeta(inputArgs: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    hasUnattributedData: boolean;
  }): ReportScopeMeta {
    return {
      scopeType: inputArgs.scope.scopeType,
      requestedCounterpartyIds: inputArgs.scope.requestedCounterpartyIds,
      requestedGroupIds: inputArgs.scope.requestedGroupIds,
      requestedBookIds: inputArgs.scope.requestedBookIds,
      resolvedCounterpartyIdsCount: inputArgs.scope.resolvedCounterpartyIds.length,
      attributionMode: inputArgs.attributionMode,
      hasUnattributedData: inputArgs.hasUnattributedData,
    };
  }

  async function fetchScopedPostings(inputArgs: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    statuses: FinancialResultStatus[];
    from?: Date;
    to?: Date;
    asOf?: Date;
    currency?: string;
    includeUnattributed: boolean;
  }): Promise<ScopedPosting[]> {
    const internalLedgerOrganizationIds =
      inputArgs.attributionMode === "book_org"
        ? await organizationsQueries.listInternalLedgerOrganizationIds()
        : [];

    const rows = await ledgerQueries.listScopedPostingRows({
      scopeType: inputArgs.scope.scopeType,
      resolvedCounterpartyIds: inputArgs.scope.resolvedCounterpartyIds,
      resolvedBookIds: inputArgs.scope.resolvedBookIds,
      attributionMode: inputArgs.attributionMode,
      statuses: inputArgs.statuses,
      from: inputArgs.from,
      to: inputArgs.to,
      asOf: inputArgs.asOf,
      currency: inputArgs.currency,
      includeUnattributed: inputArgs.includeUnattributed,
      internalLedgerOrganizationIds,
    });
    const documentRefsByOperationId =
      await documentsPort.listOperationDocumentRefs(
        Array.from(new Set(rows.map((row) => row.operationId))),
      );

    return rows.map((row: AccountingScopedPostingRow) => ({
      operationId: row.operationId,
      lineNo: row.lineNo,
      postingDate: new Date(row.postingDate),
      status: row.status,
      bookId: row.bookId,
      bookLabel: row.bookLabel,
      bookCounterpartyId: row.bookCounterpartyId,
      currency: row.currency,
      amountMinor: parseMinorAmount(row.amountMinor),
      postingCode: row.postingCode,
      debitAccountNo: row.debitAccountNo,
      creditAccountNo: row.creditAccountNo,
      analyticCounterpartyId: row.analyticCounterpartyId,
      documentId:
        documentRefsByOperationId.get(row.operationId)?.documentId ?? null,
      documentType:
        documentRefsByOperationId.get(row.operationId)?.documentType ?? null,
      channel: documentRefsByOperationId.get(row.operationId)?.channel ?? null,
    }));
  }

  return {
    buildScopeMeta,
    fetchScopedPostings,
    listInternalLedgerOrganizationIds,
    resolveScope,
  };
}
