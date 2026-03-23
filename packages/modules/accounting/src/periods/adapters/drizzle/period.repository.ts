import { and, desc, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type { PeriodRepository } from "../../application/ports/period.repository";

export class DrizzlePeriodRepository implements PeriodRepository {
  constructor(private readonly db: Queryable) {}

  async upsertClosedPeriodLock(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closeDocumentId: string;
    closeReason?: string | null;
    closedBy: string;
    closedAt: Date;
  }) {
    const [lock] = await this.db
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
  }

  async upsertReopenedPeriodLock(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenedAt: Date;
  }) {
    const [lock] = await this.db
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
  }

  async findLatestClosePackage(input: {
    organizationId: string;
    periodStart: Date;
  }) {
    const [closePackage] = await this.db
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
          eq(schema.accountingClosePackages.organizationId, input.organizationId),
          eq(schema.accountingClosePackages.periodStart, input.periodStart),
        ),
      )
      .orderBy(desc(schema.accountingClosePackages.revision))
      .limit(1);

    return closePackage ?? null;
  }

  async markClosePackageSuperseded(input: {
    id: string;
    reopenDocumentId?: string | null;
  }) {
    await this.db
      .update(schema.accountingClosePackages)
      .set({
        state: "superseded",
        reopenDocumentId: input.reopenDocumentId ?? null,
      })
      .where(eq(schema.accountingClosePackages.id, input.id));
  }

  async findMaxClosePackageRevision(input: {
    organizationId: string;
    periodStart: Date;
  }) {
    const [row] = await this.db
      .select({
        revision: schema.accountingClosePackages.revision,
      })
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(schema.accountingClosePackages.organizationId, input.organizationId),
          eq(schema.accountingClosePackages.periodStart, input.periodStart),
        ),
      )
      .orderBy(desc(schema.accountingClosePackages.revision))
      .limit(1);

    return row?.revision ?? 0;
  }

  async insertClosePackage(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    revision: number;
    state: "closed" | "superseded";
    closeDocumentId: string;
    reopenDocumentId?: string | null;
    checksum: string;
    payload: Record<string, unknown>;
  }) {
    const [closePackage] = await this.db
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
  }
}
