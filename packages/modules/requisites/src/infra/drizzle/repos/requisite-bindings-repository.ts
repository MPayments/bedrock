import { eq, inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type {
  RequisiteAccountingBindingRecord,
  RequisiteAccountingBindingsCommandRepository,
  RequisiteAccountingBindingsQueryRepository,
} from "../../../application/bindings/ports";
import {
  organizationRequisiteBindings,
  type OrganizationRequisiteBindingRow,
} from "../schema";

function toBindingRecord(
  row: OrganizationRequisiteBindingRow,
): RequisiteAccountingBindingRecord {
  return {
    requisiteId: row.requisiteId,
    bookId: row.bookId,
    bookAccountInstanceId: row.bookAccountInstanceId,
    postingAccountNo: row.postingAccountNo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleRequisiteAccountingBindingsQueryRepository(
  db: Queryable,
): RequisiteAccountingBindingsQueryRepository {
  return {
    async findBindingByRequisiteId(requisiteId, tx) {
      const queryable = (tx as Queryable | undefined) ?? db;
      const [row] = await queryable
        .select()
        .from(organizationRequisiteBindings)
        .where(eq(organizationRequisiteBindings.requisiteId, requisiteId))
        .limit(1);

      return row ? toBindingRecord(row) : null;
    },
    async listBindingsByRequisiteId(requisiteIds, tx) {
      const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));

      if (uniqueIds.length === 0) {
        return [];
      }

      const queryable = (tx as Queryable | undefined) ?? db;
      const rows = await queryable
        .select()
        .from(organizationRequisiteBindings)
        .where(inArray(organizationRequisiteBindings.requisiteId, uniqueIds));

      return rows.map(toBindingRecord);
    },
  };
}

export function createDrizzleRequisiteAccountingBindingsCommandRepository(
  db: Queryable,
): RequisiteAccountingBindingsCommandRepository {
  return {
    async upsertBinding(input, tx) {
      const queryable = (tx as Queryable | undefined) ?? db;

      await queryable
        .insert(organizationRequisiteBindings)
        .values({
          requisiteId: input.requisiteId,
          bookId: input.bookId,
          bookAccountInstanceId: input.bookAccountInstanceId,
          postingAccountNo: input.postingAccountNo,
        })
        .onConflictDoUpdate({
          target: organizationRequisiteBindings.requisiteId,
          set: {
            bookId: input.bookId,
            bookAccountInstanceId: input.bookAccountInstanceId,
            postingAccountNo: input.postingAccountNo,
          },
        });

      const [row] = await queryable
        .select()
        .from(organizationRequisiteBindings)
        .where(eq(organizationRequisiteBindings.requisiteId, input.requisiteId))
        .limit(1);

      return row ? toBindingRecord(row) : null;
    },
  };
}
