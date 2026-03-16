import { ValidationError } from "@bedrock/shared/core/errors";
import { parseMinorAmountOrZero } from "@bedrock/shared/money";

import type {
  AccountingReportsContext,
  ClosePackageAdjustment,
  ClosePackageAuditEvent,
  ClosePackageResult,
} from "./types";
import { normalizeMonthStart } from "../../../../domain/periods";
import {
  ClosePackageQuerySchema,
  type ClosePackageQuery,
} from "../reports-validation";

function parseDateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(typeof value === "string" ? value : String(value));
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

export function createListClosePackageHandler(
  context: AccountingReportsContext,
) {
  return async function listClosePackage(
    inputQuery?: ClosePackageQuery,
  ): Promise<ClosePackageResult> {
    const query = ClosePackageQuerySchema.parse(inputQuery ?? {});
    const periodStart = normalizeMonthStart(new Date(query.periodStart));

    await context.assertInternalOrganization(query.organizationId);

    const row = await context.findLatestClosePackage({
      organizationId: query.organizationId,
      periodStart,
    });
    if (!row) {
      throw new ValidationError(
        `No close package found for organization ${query.organizationId} and period ${periodStart.toISOString()}`,
      );
    }

    const payload = row.payload as Record<string, unknown>;
    const trialBalanceSummaryByCurrency = Array.isArray(
      payload.trialBalanceSummaryByCurrency,
    )
      ? payload.trialBalanceSummaryByCurrency.map((item) => {
          const value = item as Record<string, unknown>;
          return {
            currency: String(value.currency ?? ""),
            openingDebitMinor: parseMinorAmountOrZero(value.openingDebitMinor),
            openingCreditMinor: parseMinorAmountOrZero(
              value.openingCreditMinor,
            ),
            periodDebitMinor: parseMinorAmountOrZero(value.periodDebitMinor),
            periodCreditMinor: parseMinorAmountOrZero(value.periodCreditMinor),
            closingDebitMinor: parseMinorAmountOrZero(value.closingDebitMinor),
            closingCreditMinor: parseMinorAmountOrZero(
              value.closingCreditMinor,
            ),
          };
        })
      : [];
    const incomeStatementSummaryByCurrency = Array.isArray(
      payload.incomeStatementSummaryByCurrency,
    )
      ? payload.incomeStatementSummaryByCurrency.map((item) => {
          const value = item as Record<string, unknown>;
          return {
            currency: String(value.currency ?? ""),
            revenueMinor: parseMinorAmountOrZero(value.revenueMinor),
            expenseMinor: parseMinorAmountOrZero(value.expenseMinor),
            netMinor: parseMinorAmountOrZero(value.netMinor),
          };
        })
      : [];
    const cashFlowSummaryByCurrency = Array.isArray(
      payload.cashFlowSummaryByCurrency,
    )
      ? payload.cashFlowSummaryByCurrency.map((item) => {
          const value = item as Record<string, unknown>;
          return {
            currency: String(value.currency ?? ""),
            netCashFlowMinor: parseMinorAmountOrZero(value.netCashFlowMinor),
          };
        })
      : [];
    const adjustments = Array.isArray(payload.adjustments)
      ? payload.adjustments.map((item): ClosePackageAdjustment => {
          const value = item as Record<string, unknown>;
          return {
            documentId: String(value.documentId ?? ""),
            docType: String(value.docType ?? ""),
            docNo: String(value.docNo ?? ""),
            occurredAt: parseDateValue(value.occurredAt),
            title: String(value.title ?? ""),
          };
        })
      : [];
    const auditEvents = Array.isArray(payload.auditEvents)
      ? payload.auditEvents.map((item): ClosePackageAuditEvent => {
          const value = item as Record<string, unknown>;
          return {
            id: String(value.id ?? ""),
            eventType: String(value.eventType ?? ""),
            actorId: value.actorId ? String(value.actorId) : null,
            createdAt: parseDateValue(value.createdAt),
          };
        })
      : [];

    return {
      id: row.id,
      organizationId: row.organizationId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      revision: row.revision,
      state: row.state,
      checksum: row.checksum,
      generatedAt: row.generatedAt,
      closeDocumentId: row.closeDocumentId,
      reopenDocumentId: row.reopenDocumentId,
      trialBalanceSummaryByCurrency,
      incomeStatementSummaryByCurrency,
      cashFlowSummaryByCurrency,
      adjustments,
      auditEvents,
      payload,
    };
  };
}
