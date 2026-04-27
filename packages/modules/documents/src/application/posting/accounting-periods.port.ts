import type { AccountingModule } from "@bedrock/accounting";

import type { DocumentsAccountingPeriodsPort } from "./ports";

export interface CreateDocumentsAccountingPeriodsPortInput {
  accountingModule: AccountingModule;
  createAccountingModuleForTransaction(db: unknown): AccountingModule;
}

export function createDocumentsAccountingPeriodsPort(
  input: CreateDocumentsAccountingPeriodsPortInput,
): DocumentsAccountingPeriodsPort {
  const { accountingModule, createAccountingModuleForTransaction } = input;

  function resolveAccountingModule(db: unknown) {
    return db ? createAccountingModuleForTransaction(db) : accountingModule;
  }

  return {
    assertOrganizationPeriodsOpen(periodInput) {
      return accountingModule.periods.commands.assertOrganizationPeriodsOpen(
        periodInput,
      );
    },
    listClosedOrganizationIdsForPeriod(periodInput) {
      return accountingModule.periods.queries.listClosedOrganizationIdsForPeriod(
        periodInput,
      );
    },
    closePeriod(periodInput) {
      return resolveAccountingModule(
        periodInput.db,
      ).periods.commands.closePeriod({
        organizationId: periodInput.organizationId,
        periodStart: periodInput.periodStart,
        periodEnd: periodInput.periodEnd,
        closedBy: periodInput.closedBy,
        closeReason: periodInput.closeReason,
        closeDocumentId: periodInput.closeDocumentId,
      });
    },
    isOrganizationPeriodClosed(periodInput) {
      return accountingModule.periods.queries.isOrganizationPeriodClosed(
        periodInput,
      );
    },
    reopenPeriod(periodInput) {
      return resolveAccountingModule(
        periodInput.db,
      ).periods.commands.reopenPeriod({
        organizationId: periodInput.organizationId,
        periodStart: periodInput.periodStart,
        reopenedBy: periodInput.reopenedBy,
        reopenReason: periodInput.reopenReason,
        reopenDocumentId: periodInput.reopenDocumentId,
      });
    },
  };
}
