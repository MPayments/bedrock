import { and, desc, eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { AccountingPeriodsRepository } from "../../../application/periods/ports";
import { schema } from "../../../schema";

type Queryable = Database | Transaction;

export function createDrizzleAccountingPeriodsRepository(
  db: Queryable,
): AccountingPeriodsRepository {
  return {
    findClosedPeriodLock: async ({ organizationId, periodStart }) => {
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
    upsertClosedPeriodLock: async (input) => {
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
    upsertReopenedPeriodLock: async (input) => {
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
    findLatestClosePackage: async ({ organizationId, periodStart }) => {
      const [closePackage] = await db
        .select({
          id: schema.accountingClosePackages.id,
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
    markClosePackageSuperseded: async ({ id, reopenDocumentId }) => {
      await db
        .update(schema.accountingClosePackages)
        .set({
          state: "superseded",
          reopenDocumentId: reopenDocumentId ?? null,
        })
        .where(eq(schema.accountingClosePackages.id, id));
    },
    findMaxClosePackageRevision: async ({ organizationId, periodStart }) => {
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
    insertClosePackage: async (input) => {
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
