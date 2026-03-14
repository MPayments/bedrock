import { and, desc, eq, lte } from "drizzle-orm";
import type { Database, Transaction } from "@bedrock/platform-persistence";

import { schema } from "../../../schema";
import type { AccountingChartRepository } from "../../../application/chart/ports";
import type { AccountingPacksRepository } from "../../../application/packs/ports";
import type { AccountingPeriodsRepository } from "../../../application/periods/ports";

type Queryable = Database | Transaction;

export function createDrizzleAccountingChartRepository(
  db: Database,
): AccountingChartRepository {
  return {
    listTemplateAccounts: async () =>
      db
        .select()
        .from(schema.chartTemplateAccounts)
        .orderBy(schema.chartTemplateAccounts.accountNo),
    listCorrespondenceRules: async () =>
      db
        .select()
        .from(schema.correspondenceRules)
        .orderBy(
          schema.correspondenceRules.postingCode,
          schema.correspondenceRules.debitAccountNo,
          schema.correspondenceRules.creditAccountNo,
        ),
    replaceCorrespondenceRules: async (rules) =>
      db.transaction(async (tx) => {
        await tx.delete(schema.correspondenceRules);

        if (rules.length === 0) {
          return [];
        }

        return tx
          .insert(schema.correspondenceRules)
          .values(
            rules.map((rule) => ({
              postingCode: rule.postingCode,
              debitAccountNo: rule.debitAccountNo,
              creditAccountNo: rule.creditAccountNo,
              enabled: rule.enabled,
            })),
          )
          .returning();
      }),
    readPostingMatrixValidationInput: async () => {
      const [rules, accounts, accountDimPolicies, postingCodeDimPolicies] =
        await Promise.all([
          db
            .select()
            .from(schema.correspondenceRules)
            .where(eq(schema.correspondenceRules.enabled, true)),
          db.select().from(schema.chartTemplateAccounts),
          db.select().from(schema.chartAccountDimensionPolicy),
          db
            .select()
            .from(schema.postingCodeDimensionPolicy)
            .where(eq(schema.postingCodeDimensionPolicy.required, true)),
        ]);

      return {
        rules,
        accounts,
        accountDimPolicies,
        postingCodeDimPolicies,
      };
    },
  };
}

export function createDrizzleAccountingPacksRepository(
  db: Queryable,
): AccountingPacksRepository {
  return {
    findPackVersion: async ({ packKey, version }) => {
      const [row] = await db
        .select({
          checksum: schema.accountingPackVersions.checksum,
          compiledJson: schema.accountingPackVersions.compiledJson,
        })
        .from(schema.accountingPackVersions)
        .where(
          and(
            eq(schema.accountingPackVersions.packKey, packKey),
            eq(schema.accountingPackVersions.version, version),
          ),
        )
        .limit(1);

      return row ?? null;
    },
    insertPackVersion: async (input) => {
      await db.insert(schema.accountingPackVersions).values(input);
    },
    updatePackVersion: async (input) => {
      await db
        .update(schema.accountingPackVersions)
        .set({
          checksum: input.checksum,
          compiledJson: input.compiledJson,
          compiledAt: input.compiledAt,
        })
        .where(
          and(
            eq(schema.accountingPackVersions.packKey, input.packKey),
            eq(schema.accountingPackVersions.version, input.version),
          ),
        );
    },
    hasAssignmentsForPackChecksum: async (checksum) => {
      const [assignment] = await db
        .select({ id: schema.accountingPackAssignments.id })
        .from(schema.accountingPackAssignments)
        .where(eq(schema.accountingPackAssignments.packChecksum, checksum))
        .limit(1);

      return Boolean(assignment);
    },
    findPackByChecksum: async (checksum) => {
      const [row] = await db
        .select({
          checksum: schema.accountingPackVersions.checksum,
          compiledJson: schema.accountingPackVersions.compiledJson,
        })
        .from(schema.accountingPackVersions)
        .where(eq(schema.accountingPackVersions.checksum, checksum))
        .limit(1);

      return row ?? null;
    },
    insertPackAssignment: async (input) => {
      await db.insert(schema.accountingPackAssignments).values(input);
    },
    findActivePackAssignment: async ({ scopeType, scopeId, effectiveAt }) => {
      const [assignment] = await db
        .select({
          packChecksum: schema.accountingPackAssignments.packChecksum,
        })
        .from(schema.accountingPackAssignments)
        .where(
          and(
            eq(schema.accountingPackAssignments.scopeType, scopeType),
            eq(schema.accountingPackAssignments.scopeId, scopeId),
            lte(schema.accountingPackAssignments.effectiveAt, effectiveAt),
          ),
        )
        .orderBy(desc(schema.accountingPackAssignments.effectiveAt))
        .limit(1);

      return assignment ?? null;
    },
  };
}

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
      const rows = await db
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

      return rows[0]?.revision ?? 0;
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
