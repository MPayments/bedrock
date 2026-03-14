export {
  AssertOrganizationPeriodsOpenInputSchema,
  ClosePeriodInputSchema,
  ReopenPeriodInputSchema,
  type AssertOrganizationPeriodsOpenInput,
  type ClosePeriodInput,
  type ReopenPeriodInput,
} from "./contracts/periods/commands";
export {
  AccountingClosePackageStateSchema,
  AccountingPeriodStateSchema,
} from "./contracts/periods/zod";
export {
  getPreviousCalendarMonthRange,
  type AccountingPeriodsService,
} from "./application/periods";
import { sha256Hex } from "@bedrock/platform/crypto";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { canonicalJson } from "@bedrock/shared/core/canon";
import { ValidationError } from "@bedrock/shared/core/errors";

import {
  createAccountingPeriodsHandlers,
  type AccountingPeriodsService,
} from "./application/periods";
import { toJsonSafeValue } from "./application/periods/json-safe-value";
import { createDrizzleAccountingPeriodsRepository } from "./infra/drizzle/repos/periods-repository";
import { createAccountingReportingRuntime } from "./reporting-runtime";

type Queryable = Database | Transaction;

export interface AccountingPeriodsDocumentsQueries {
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

export interface AccountingPeriodsServiceDeps {
  db: Database;
  documentsQueriesFactory?: (input: {
    db: Queryable;
  }) => AccountingPeriodsDocumentsQueries;
}

function createClosePackageSnapshotPort(input: {
  db: Queryable;
  documentsQueriesFactory?: AccountingPeriodsServiceDeps["documentsQueriesFactory"];
}) {
  const { db, documentsQueriesFactory } = input;
  const {
    ledgerQueries,
    organizationsQueries,
    reportQueries: reports,
  } = createAccountingReportingRuntime({ db });
  const periodsRepository = createDrizzleAccountingPeriodsRepository(db);
  const documentsQueries = documentsQueriesFactory?.({ db });

  return {
    async generateClosePackageSnapshot(snapshotInput: {
      organizationId: string;
      periodStart: Date;
      periodEnd: Date;
      closeDocumentId: string;
    }) {
      await organizationsQueries.assertInternalLedgerOrganization(
        snapshotInput.organizationId,
      );

      const organizationBooks = await ledgerQueries.listBooksByOwnerId(
        snapshotInput.organizationId,
      );

      if (organizationBooks.length === 0) {
        throw new ValidationError(
          `No internal-ledger books found for organization ${snapshotInput.organizationId}`,
        );
      }

      if (!documentsQueries) {
        throw new Error(
          "Accounting periods close package snapshot requires documentsQueriesFactory",
        );
      }

      const organizationBookIds = organizationBooks.map((row) => row.id);
      const [trialBalance, incomeStatement, cashFlow, adjustments] =
        await Promise.all([
          reports.listTrialBalance({
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
          reports.listIncomeStatement({
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
          reports.listCashFlow({
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
          documentsQueries.listAdjustmentsForOrganizationPeriod({
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

      const auditEvents = await documentsQueries.listAuditEventsByDocumentId(
        adjustments.map((row) => row.documentId),
      );

      const payload = toJsonSafeValue({
        trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
        incomeStatementSummaryByCurrency: incomeStatement.summaryByCurrency,
        cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
        adjustments,
        auditEvents,
      }) as Record<string, unknown>;

      const checksum = sha256Hex(canonicalJson(payload));
      const revision =
        (await periodsRepository.findMaxClosePackageRevision({
          organizationId: snapshotInput.organizationId,
          periodStart: snapshotInput.periodStart,
        })) + 1;

      return periodsRepository.insertClosePackage({
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

function buildAccountingPeriodsService(input: {
  db: Queryable;
  documentsQueriesFactory?: AccountingPeriodsServiceDeps["documentsQueriesFactory"];
}) {
  return createAccountingPeriodsHandlers({
    repository: createDrizzleAccountingPeriodsRepository(input.db),
    closePackageSnapshotPort: createClosePackageSnapshotPort(input),
  });
}

export function createAccountingPeriodsService(
  deps: AccountingPeriodsServiceDeps,
): {
  isOrganizationPeriodClosed: (input: {
    db?: Queryable;
    organizationId: string;
    occurredAt: Date;
  }) => ReturnType<AccountingPeriodsService["isOrganizationPeriodClosed"]>;
  assertOrganizationPeriodsOpen: (input: {
    db?: Queryable;
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }) => ReturnType<AccountingPeriodsService["assertOrganizationPeriodsOpen"]>;
  closePeriod: (input: {
    db?: Queryable;
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }) => ReturnType<AccountingPeriodsService["closePeriod"]>;
  reopenPeriod: (input: {
    db?: Queryable;
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }) => ReturnType<AccountingPeriodsService["reopenPeriod"]>;
} {
  async function runWithService<T>(input: {
    db?: Queryable;
    transactional?: boolean;
    run: (service: AccountingPeriodsService) => Promise<T>;
  }) {
    const execute = (db: Queryable) =>
      input.run(
        buildAccountingPeriodsService({
          db,
          documentsQueriesFactory: deps.documentsQueriesFactory,
        }),
      );

    if (input.db) {
      return execute(input.db);
    }

    if (input.transactional) {
      return deps.db.transaction((tx) => execute(tx));
    }

    return execute(deps.db);
  }

  return {
    isOrganizationPeriodClosed(input) {
      return runWithService({
        db: input.db,
        run: (service) =>
          service.isOrganizationPeriodClosed({
            organizationId: input.organizationId,
            occurredAt: input.occurredAt,
          }),
      });
    },
    assertOrganizationPeriodsOpen(input) {
      return runWithService({
        db: input.db,
        run: (service) =>
          service.assertOrganizationPeriodsOpen({
            occurredAt: input.occurredAt,
            organizationIds: input.organizationIds,
            docType: input.docType,
          }),
      });
    },
    closePeriod(input) {
      return runWithService({
        db: input.db,
        transactional: true,
        run: (service) =>
          service.closePeriod({
            organizationId: input.organizationId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            closedBy: input.closedBy,
            closeReason: input.closeReason,
            closeDocumentId: input.closeDocumentId,
          }),
      });
    },
    reopenPeriod(input) {
      return runWithService({
        db: input.db,
        transactional: true,
        run: (service) =>
          service.reopenPeriod({
            organizationId: input.organizationId,
            periodStart: input.periodStart,
            reopenedBy: input.reopenedBy,
            reopenReason: input.reopenReason,
            reopenDocumentId: input.reopenDocumentId,
          }),
      });
    },
  };
}
