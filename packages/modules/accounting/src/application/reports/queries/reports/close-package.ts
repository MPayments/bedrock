import { and, eq, sql } from "drizzle-orm";

import { ValidationError } from "@bedrock/core/errors";

import type {
  AccountingReportsContext,
  ClosePackageAdjustment,
  ClosePackageAuditEvent,
  ClosePackageResult,
} from "./types";
import {
  normalizeMonthStart,
  toBigInt,
  toDateValue,
} from "../../../../domain/reports/normalization";
import { schema } from "../../../../infra/reporting/query-support/shared";
import { assertAccountingOrganizationIsInternal } from "../../../../infra/organizations/internal-ledger";
import {
  ClosePackageQuerySchema,
  type ClosePackageQuery,
} from "../reports-validation";

export function createListClosePackageHandler(
  context: AccountingReportsContext,
) {
  return async function listClosePackage(
    inputQuery?: ClosePackageQuery,
  ): Promise<ClosePackageResult> {
    const query = ClosePackageQuerySchema.parse(inputQuery ?? {});
    const periodStart = normalizeMonthStart(new Date(query.periodStart));

    await assertAccountingOrganizationIsInternal({
      db: context.db,
      organizationId: query.organizationId,
    });

    const existingRows = await context.db
      .select()
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(schema.accountingClosePackages.organizationId, query.organizationId),
          eq(schema.accountingClosePackages.periodStart, periodStart),
        ),
      )
      .orderBy(sql`${schema.accountingClosePackages.revision} DESC`)
      .limit(1);

    const row = existingRows[0];
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
            openingDebitMinor: toBigInt(value.openingDebitMinor),
            openingCreditMinor: toBigInt(value.openingCreditMinor),
            periodDebitMinor: toBigInt(value.periodDebitMinor),
            periodCreditMinor: toBigInt(value.periodCreditMinor),
            closingDebitMinor: toBigInt(value.closingDebitMinor),
            closingCreditMinor: toBigInt(value.closingCreditMinor),
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
            revenueMinor: toBigInt(value.revenueMinor),
            expenseMinor: toBigInt(value.expenseMinor),
            netMinor: toBigInt(value.netMinor),
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
            netCashFlowMinor: toBigInt(value.netCashFlowMinor),
          };
        })
      : [];
    const adjustments = Array.isArray(payload.adjustments)
      ? payload.adjustments.map(
          (item): ClosePackageAdjustment => {
            const value = item as Record<string, unknown>;
            return {
              documentId: String(value.documentId ?? ""),
              docType: String(value.docType ?? ""),
              docNo: String(value.docNo ?? ""),
              occurredAt: toDateValue(value.occurredAt),
              title: String(value.title ?? ""),
            };
          },
        )
      : [];
    const auditEvents = Array.isArray(payload.auditEvents)
      ? payload.auditEvents.map(
          (item): ClosePackageAuditEvent => {
            const value = item as Record<string, unknown>;
            return {
              id: String(value.id ?? ""),
              eventType: String(value.eventType ?? ""),
              actorId: value.actorId ? String(value.actorId) : null,
              createdAt: toDateValue(value.createdAt),
            };
          },
        )
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
