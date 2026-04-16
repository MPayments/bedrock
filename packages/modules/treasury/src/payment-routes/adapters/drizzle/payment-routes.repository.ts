import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  type ListPaymentRouteTemplatesQuery,
} from "../../application/contracts/queries";
import type {
  PaymentRouteTemplateRecord,
  PaymentRouteTemplateWriteModel,
  PaymentRouteTemplatesRepository,
} from "../../application/ports/payment-routes.repository";
import { paymentRouteTemplates } from "./schema";

function deriveSummaryColumns(draft: PaymentRouteTemplateWriteModel["draft"]) {
  const sourceParticipant = draft.participants[0]!;
  const destinationParticipant = draft.participants[draft.participants.length - 1]!;

  return {
    currencyInId: draft.currencyInId,
    currencyOutId: draft.currencyOutId,
    destinationEntityId: destinationParticipant.entityId,
    destinationEntityKind: destinationParticipant.kind as "counterparty" | "organization",
    hopCount: Math.max(draft.participants.length - 2, 0),
    sourceCustomerId: sourceParticipant.entityId,
  };
}

function mapRecord(
  row: typeof paymentRouteTemplates.$inferSelect,
): PaymentRouteTemplateRecord {
  return {
    createdAt: row.createdAt,
    draft: row.draft,
    id: row.id,
    lastCalculation: row.lastCalculation ?? null,
    name: row.name,
    snapshotPolicy: row.snapshotPolicy,
    status: row.status,
    updatedAt: row.updatedAt,
    visual: row.visual,
  };
}

export class DrizzlePaymentRouteTemplatesRepository
  implements PaymentRouteTemplatesRepository
{
  constructor(private readonly db: Queryable) {}

  async insertTemplate(input: PaymentRouteTemplateWriteModel) {
    const inserted = await this.db
      .insert(paymentRouteTemplates)
      .values({
        ...deriveSummaryColumns(input.draft),
        createdAt: input.createdAt,
        draft: input.draft,
        id: input.id,
        lastCalculation: input.lastCalculation,
        name: input.name,
        snapshotPolicy: input.snapshotPolicy,
        status: input.status,
        updatedAt: input.updatedAt,
        visual: input.visual,
      })
      .returning();

    return mapRecord(inserted[0]!);
  }

  async updateTemplate(
    id: string,
    input: Partial<
      Pick<
        PaymentRouteTemplateWriteModel,
        "draft" | "lastCalculation" | "name" | "status" | "updatedAt" | "visual"
      >
    >,
  ) {
    const summaryColumns = input.draft ? deriveSummaryColumns(input.draft) : {};
    const updated = await this.db
      .update(paymentRouteTemplates)
      .set({
        ...summaryColumns,
        ...(input.draft ? { draft: input.draft } : {}),
        ...(input.lastCalculation !== undefined
          ? { lastCalculation: input.lastCalculation }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.updatedAt !== undefined ? { updatedAt: input.updatedAt } : {}),
        ...(input.visual !== undefined ? { visual: input.visual } : {}),
      })
      .where(eq(paymentRouteTemplates.id, id))
      .returning();

    return updated[0] ? mapRecord(updated[0]) : null;
  }

  async findTemplateById(id: string) {
    const rows = await this.db
      .select()
      .from(paymentRouteTemplates)
      .where(eq(paymentRouteTemplates.id, id))
      .limit(1);

    return rows[0] ? mapRecord(rows[0]) : null;
  }

  async listTemplates(input: ListPaymentRouteTemplatesQuery) {
    const conditions = [];

    if (input.name) {
      conditions.push(ilike(paymentRouteTemplates.name, `%${input.name}%`));
    }

    if (input.status) {
      conditions.push(eq(paymentRouteTemplates.status, input.status as any));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn =
      input.sortBy === "createdAt"
        ? paymentRouteTemplates.createdAt
        : input.sortBy === "name"
          ? paymentRouteTemplates.name
          : input.sortBy === "status"
            ? paymentRouteTemplates.status
            : paymentRouteTemplates.updatedAt;
    const sortDirection =
      input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(paymentRouteTemplates)
        .where(where)
        .orderBy(sortDirection, desc(paymentRouteTemplates.updatedAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(paymentRouteTemplates)
        .where(where),
    ]);

    return {
      rows: rows.map(mapRecord),
      total: totalRows[0]?.total ?? 0,
    };
  }
}
