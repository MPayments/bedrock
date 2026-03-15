import { sha256Hex } from "@bedrock/platform/crypto";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toJsonSafe } from "@bedrock/shared/core/json";

import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsRepository,
} from "../../application/periods/ports";
import type { AccountingReportQueries } from "../../application/reports/queries/reports";

export interface AccountingPeriodsDocumentsReadModel {
  listAdjustmentsForOrganizationPeriod: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    docTypes: string[];
  }) => Promise<
    {
      documentId: string;
      docType: string;
      docNo: string;
      occurredAt: Date;
      title: string;
    }[]
  >;
  listAuditEventsByDocumentId: (documentIds: string[]) => Promise<
    {
      id: string;
      eventType: string;
      actorId: string | null;
      createdAt: Date;
    }[]
  >;
}

export function createAccountingClosePackageSnapshotPort(input: {
  repository: Pick<
    AccountingPeriodsRepository,
    "findMaxClosePackageRevision" | "insertClosePackage"
  >;
  assertInternalLedgerOrganization: (organizationId: string) => Promise<void>;
  listBooksByOwnerId: (organizationId: string) => Promise<{ id: string }[]>;
  reportQueries: Pick<
    AccountingReportQueries,
    "listCashFlow" | "listIncomeStatement" | "listTrialBalance"
  >;
  documentsReadModel: AccountingPeriodsDocumentsReadModel;
}): AccountingClosePackageSnapshotPort {
  const {
    repository,
    assertInternalLedgerOrganization,
    listBooksByOwnerId,
    reportQueries,
    documentsReadModel,
  } = input;

  return {
    async generateClosePackageSnapshot(snapshotInput) {
      await assertInternalLedgerOrganization(snapshotInput.organizationId);

      const organizationBooks = await listBooksByOwnerId(
        snapshotInput.organizationId,
      );

      if (organizationBooks.length === 0) {
        throw new ValidationError(
          `No internal-ledger books found for organization ${snapshotInput.organizationId}`,
        );
      }

      const organizationBookIds = organizationBooks.map((row) => row.id);
      const [trialBalance, incomeStatement, cashFlow, adjustments] =
        await Promise.all([
          reportQueries.listTrialBalance({
            scopeType: "book",
            counterpartyId: [],
            groupId: [],
            bookId: organizationBookIds,
            includeDescendants: true,
            attributionMode: "book_org",
            includeUnattributed: false,
            currency: undefined,
            status: ["posted"],
            from: snapshotInput.periodStart.toISOString(),
            to: snapshotInput.periodEnd.toISOString(),
            limit: 200,
            offset: 0,
            sortBy: "accountNo",
            sortOrder: "asc",
          }),
          reportQueries.listIncomeStatement({
            scopeType: "book",
            counterpartyId: [],
            groupId: [],
            bookId: organizationBookIds,
            includeDescendants: true,
            attributionMode: "book_org",
            includeUnattributed: false,
            currency: undefined,
            status: ["posted"],
            from: snapshotInput.periodStart.toISOString(),
            to: snapshotInput.periodEnd.toISOString(),
          }),
          reportQueries.listCashFlow({
            scopeType: "book",
            counterpartyId: [],
            groupId: [],
            bookId: organizationBookIds,
            includeDescendants: true,
            attributionMode: "book_org",
            includeUnattributed: false,
            currency: undefined,
            status: ["posted"],
            from: snapshotInput.periodStart.toISOString(),
            to: snapshotInput.periodEnd.toISOString(),
            method: "direct",
          }),
          documentsReadModel.listAdjustmentsForOrganizationPeriod({
            organizationId: snapshotInput.organizationId,
            periodStart: snapshotInput.periodStart,
            periodEnd: snapshotInput.periodEnd,
            docTypes: [
              "accrual_adjustment",
              "revaluation_adjustment",
              "impairment_adjustment",
              "closing_reclass",
            ],
          }),
        ]);

      const auditEvents = await documentsReadModel.listAuditEventsByDocumentId(
        adjustments.map((row) => row.documentId),
      );

      const payload = toJsonSafe({
        trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
        incomeStatementSummaryByCurrency: incomeStatement.summaryByCurrency,
        cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
        adjustments,
        auditEvents,
      }) as Record<string, unknown>;

      const checksum = sha256Hex(canonicalJson(payload));
      const revision =
        (await repository.findMaxClosePackageRevision({
          organizationId: snapshotInput.organizationId,
          periodStart: snapshotInput.periodStart,
        })) + 1;

      return repository.insertClosePackage({
        organizationId: snapshotInput.organizationId,
        periodStart: snapshotInput.periodStart,
        periodEnd: snapshotInput.periodEnd,
        revision,
        state: "closed",
        closeDocumentId: snapshotInput.closeDocumentId,
        reopenDocumentId: null,
        checksum,
        payload,
      });
    },
  };
}
