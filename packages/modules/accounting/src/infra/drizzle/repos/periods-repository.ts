import { and, desc, eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  AccountingPeriodsCommandRepository,
  AccountingPeriodsQueryRepository,
} from "../../../application/periods/ports";
import { schema } from "../schema";

export function createDrizzleAccountingPeriodsQueryRepository(
  db: Database | Transaction,
): AccountingPeriodsQueryRepository {
  return {
    async findClosedPeriodLock({ organizationId, periodStart }) {
      const [lock] = await db
        .select({
          id: schema.accountingPeriodLocks.id,
        })
        .from(schema.accountingPeriodLocks)
        .where(
          and(
            eq(schema.accountingPeriodLocks.organizationId, organizationId),
            eq(schema.accountingPeriodLocks.periodStart, periodStart),
            eq(schema.accountingPeriodLocks.state, "closed"),
          ),
        )
        .limit(1);

      return lock ?? null;
    },
    async listClosedOrganizationIdsForPeriod({ organizationIds, periodStart }) {
      const uniqueOrganizationIds = Array.from(
        new Set(organizationIds.filter(Boolean)),
      );
      if (uniqueOrganizationIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({
          organizationId: schema.accountingPeriodLocks.organizationId,
        })
        .from(schema.accountingPeriodLocks)
        .where(
          and(
            inArray(
              schema.accountingPeriodLocks.organizationId,
              uniqueOrganizationIds,
            ),
            eq(schema.accountingPeriodLocks.periodStart, periodStart),
            eq(schema.accountingPeriodLocks.state, "closed"),
          ),
        );

      return rows.map((row) => row.organizationId);
    },
  };
}

export function createDrizzleAccountingPeriodsCommandRepository(
  db: Database | Transaction,
): AccountingPeriodsCommandRepository {
  return {
    async upsertClosedPeriodLock(input) {
      const [lock] = await db
        .insert(schema.accountingPeriodLocks)
        .values({
          organizationId: input.organizationId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          state: "closed",
          lockedByDocumentId: input.closeDocumentId,
          closeReason: input.closeReason ?? null,
          closedBy: input.closedBy,
          closedAt: input.closedAt,
          reopenedBy: null,
          reopenReason: null,
          reopenedAt: null,
        })
        .onConflictDoUpdate({
          target: [
            schema.accountingPeriodLocks.organizationId,
            schema.accountingPeriodLocks.periodStart,
          ],
          set: {
            periodEnd: input.periodEnd,
            state: "closed",
            lockedByDocumentId: input.closeDocumentId,
            closeReason: input.closeReason ?? null,
            closedBy: input.closedBy,
            closedAt: input.closedAt,
            reopenedBy: null,
            reopenReason: null,
            reopenedAt: null,
          },
        })
        .returning();

      return lock!;
    },
    async upsertReopenedPeriodLock(input) {
      const [lock] = await db
        .insert(schema.accountingPeriodLocks)
        .values({
          organizationId: input.organizationId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          state: "reopened",
          lockedByDocumentId: null,
          closeReason: null,
          closedBy: null,
          closedAt: null,
          reopenedBy: input.reopenedBy,
          reopenReason: input.reopenReason ?? null,
          reopenedAt: input.reopenedAt,
        })
        .onConflictDoUpdate({
          target: [
            schema.accountingPeriodLocks.organizationId,
            schema.accountingPeriodLocks.periodStart,
          ],
          set: {
            state: "reopened",
            reopenedBy: input.reopenedBy,
            reopenReason: input.reopenReason ?? null,
            reopenedAt: input.reopenedAt,
          },
        })
        .returning();

      return lock!;
    },
    async findLatestClosePackage({ organizationId, periodStart }) {
      const [closePackage] = await db
        .select({
          id: schema.accountingClosePackages.id,
          organizationId: schema.accountingClosePackages.organizationId,
          periodStart: schema.accountingClosePackages.periodStart,
          periodEnd: schema.accountingClosePackages.periodEnd,
          revision: schema.accountingClosePackages.revision,
          state: schema.accountingClosePackages.state,
          closeDocumentId: schema.accountingClosePackages.closeDocumentId,
          reopenDocumentId: schema.accountingClosePackages.reopenDocumentId,
          checksum: schema.accountingClosePackages.checksum,
          payload: schema.accountingClosePackages.payload,
          generatedAt: schema.accountingClosePackages.generatedAt,
          createdAt: schema.accountingClosePackages.createdAt,
        })
        .from(schema.accountingClosePackages)
        .where(
          and(
            eq(schema.accountingClosePackages.organizationId, organizationId),
            eq(schema.accountingClosePackages.periodStart, periodStart),
          ),
        )
        .orderBy(desc(schema.accountingClosePackages.revision))
        .limit(1);

      return closePackage ?? null;
    },
    async markClosePackageSuperseded({ id, reopenDocumentId }) {
      await db
        .update(schema.accountingClosePackages)
        .set({
          state: "superseded",
          reopenDocumentId: reopenDocumentId ?? null,
        })
        .where(eq(schema.accountingClosePackages.id, id));
    },
    async findMaxClosePackageRevision({ organizationId, periodStart }) {
      const [row] = await db
        .select({
          revision: schema.accountingClosePackages.revision,
        })
        .from(schema.accountingClosePackages)
        .where(
          and(
            eq(schema.accountingClosePackages.organizationId, organizationId),
            eq(schema.accountingClosePackages.periodStart, periodStart),
          ),
        )
        .orderBy(desc(schema.accountingClosePackages.revision))
        .limit(1);

      return row?.revision ?? 0;
    },
    async insertClosePackage(input) {
      const [closePackage] = await db
        .insert(schema.accountingClosePackages)
        .values({
          organizationId: input.organizationId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          revision: input.revision,
          state: input.state,
          closeDocumentId: input.closeDocumentId,
          reopenDocumentId: input.reopenDocumentId ?? null,
          checksum: input.checksum,
          payload: input.payload,
        })
        .returning();

      return closePackage!;
    },
  };
}
