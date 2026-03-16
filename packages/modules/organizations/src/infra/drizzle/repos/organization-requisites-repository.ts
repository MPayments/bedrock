import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  OrganizationRequisiteBindingRecord,
  OrganizationRequisiteBindingsQueryRepository,
} from "../../../application/requisites/ports";
import {
  organizationRequisiteBindings,
  type OrganizationRequisiteBindingRow,
} from "../schema";

function toBindingRecord(
  row: OrganizationRequisiteBindingRow,
): OrganizationRequisiteBindingRecord {
  return {
    requisiteId: row.requisiteId,
    bookId: row.bookId,
    bookAccountInstanceId: row.bookAccountInstanceId,
    postingAccountNo: row.postingAccountNo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleOrganizationRequisiteBindingsQueryRepository(
  db: Database,
): OrganizationRequisiteBindingsQueryRepository {
  return {
    async findBindingByRequisiteId(requisiteId, tx) {
      const [row] = await (tx ?? db)
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

      const rows = await (tx ?? db)
        .select()
        .from(organizationRequisiteBindings)
        .where(inArray(organizationRequisiteBindings.requisiteId, uniqueIds));

      return rows.map(toBindingRecord);
    },
  };
}

export function createDrizzleOrganizationRequisiteBindingsCommandRepository(
  db: Database,
) {
  return {
    async upsertBindingTx(
      tx: Transaction,
      input: {
        requisiteId: string;
        bookId: string;
        bookAccountInstanceId: string;
        postingAccountNo: string;
      },
    ) {
      await tx
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

      const [row] = await tx
        .select()
        .from(organizationRequisiteBindings)
        .where(eq(organizationRequisiteBindings.requisiteId, input.requisiteId))
        .limit(1);

      return row ? toBindingRecord(row) : null;
    },
  };
}
