import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  CustomersCommandRepository,
  CustomersQueryRepository,
} from "../../../application/customers/ports";
import type { Customer } from "../../../contracts";
import type { CustomerSnapshot } from "../../../domain/customer";
import {
  buildManagedCustomerGroupCode,
  dedupeIds,
  type GroupHierarchyNodeSnapshot,
} from "../../../domain/group-hierarchy";
import { schema } from "../schema";

const CUSTOMER_SORT_COLUMN_MAP = {
  displayName: schema.customers.displayName,
  externalRef: schema.customers.externalRef,
  createdAt: schema.customers.createdAt,
  updatedAt: schema.customers.updatedAt,
} as const;

async function findCustomerSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<CustomerSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .limit(1);

  return row ?? null;
}

async function findManagedCustomerGroup(
  db: Database,
  customerId: string,
  tx?: Transaction,
): Promise<{ id: string; name: string } | null> {
  const database = tx ?? db;
  const [row] = await database
    .select({
      id: schema.counterpartyGroups.id,
      name: schema.counterpartyGroups.name,
    })
    .from(schema.counterpartyGroups)
    .where(
      eq(
        schema.counterpartyGroups.code,
        buildManagedCustomerGroupCode(customerId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export function createDrizzleCustomersQueryRepository(
  db: Database,
): CustomersQueryRepository {
  return {
    async findCustomerById(id) {
      return findCustomerSnapshot(db, id);
    },
    async listCustomers(input) {
      const database = db;
      const conditions: SQL[] = [];

      if (input.displayName) {
        conditions.push(
          ilike(schema.customers.displayName, `%${input.displayName}%`),
        );
      }

      if (input.externalRef) {
        conditions.push(
          ilike(schema.customers.externalRef, `%${input.externalRef}%`),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByColumn = resolveSortValue(
        input.sortBy,
        CUSTOMER_SORT_COLUMN_MAP,
        schema.customers.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(schema.customers)
          .where(where)
          .orderBy(orderByFn(orderByColumn))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(schema.customers)
          .where(where),
      ]);

      return {
        data: rows,
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<Customer>;
    },
    async listCustomerDisplayNamesById(ids) {
      const uniqueIds = dedupeIds(ids);
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const database = db;
      const rows = await database
        .select({
          id: schema.customers.id,
          displayName: schema.customers.displayName,
        })
        .from(schema.customers)
        .where(inArray(schema.customers.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.displayName]));
    },
  };
}

export function createDrizzleCustomersCommandRepository(
  db: Database,
): CustomersCommandRepository {
  return {
    async findCustomerSnapshotById(id, tx) {
      return findCustomerSnapshot(db, id, tx);
    },
    async insertCustomerTx(tx, customer) {
      const [created] = await tx
        .insert(schema.customers)
        .values({
          id: customer.id,
          externalRef: customer.externalRef,
          displayName: customer.displayName,
          description: customer.description,
        })
        .returning();

      return created!;
    },
    async updateCustomerTx(tx, customer) {
      const [updated] = await tx
        .update(schema.customers)
        .set({
          externalRef: customer.externalRef,
          displayName: customer.displayName,
          description: customer.description,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.customers.id, customer.id))
        .returning();

      return updated ?? null;
    },
    async removeCustomerTx(tx, id) {
      const [deleted] = await tx
        .delete(schema.customers)
        .where(eq(schema.customers.id, id))
        .returning({ id: schema.customers.id });

      return Boolean(deleted);
    },
    async listExistingCustomerIds(ids, tx) {
      const uniqueIds = dedupeIds(ids);
      if (uniqueIds.length === 0) {
        return [];
      }

      const database = tx ?? db;
      const rows = await database
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(inArray(schema.customers.id, uniqueIds));

      return rows.map((row) => row.id);
    },
    async findManagedCustomerGroup(customerId, tx) {
      return findManagedCustomerGroup(db, customerId, tx);
    },
    async ensureManagedCustomerGroupTx(tx, input) {
      const existing = await findManagedCustomerGroup(tx, input.customerId);
      if (existing) {
        return { id: existing.id };
      }

      await tx
        .insert(schema.counterpartyGroups)
        .values({
          code: buildManagedCustomerGroupCode(input.customerId),
          name: input.displayName,
          description: "Auto-created customer group",
          parentId: null,
          customerId: input.customerId,
          isSystem: false,
        })
        .onConflictDoNothing({
          target: schema.counterpartyGroups.code,
        });

      const created = await findManagedCustomerGroup(tx, input.customerId);
      return { id: created!.id };
    },
    async renameManagedCustomerGroupTx(tx, input) {
      await tx
        .update(schema.counterpartyGroups)
        .set({
          name: input.displayName,
          updatedAt: sql`now()`,
        })
        .where(
          eq(
            schema.counterpartyGroups.code,
            buildManagedCustomerGroupCode(input.customerId),
          ),
        );
    },
    async listCounterpartiesByCustomerId(customerId, tx) {
      const database = tx ?? db;
      return database
        .select({ id: schema.counterparties.id })
        .from(schema.counterparties)
        .where(eq(schema.counterparties.customerId, customerId));
    },
    async listGroupHierarchyNodes(tx) {
      const database = tx ?? db;
      const rows = await database
        .select({
          id: schema.counterpartyGroups.id,
          code: schema.counterpartyGroups.code,
          parentId: schema.counterpartyGroups.parentId,
          customerId: schema.counterpartyGroups.customerId,
        })
        .from(schema.counterpartyGroups);

      return rows satisfies GroupHierarchyNodeSnapshot[];
    },
    async listMembershipRowsByCounterpartyIds(counterpartyIds, tx) {
      const uniqueIds = dedupeIds(counterpartyIds);
      if (uniqueIds.length === 0) {
        return [];
      }

      const database = tx ?? db;
      return database
        .select({
          counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
          groupId: schema.counterpartyGroupMemberships.groupId,
        })
        .from(schema.counterpartyGroupMemberships)
        .where(
          inArray(
            schema.counterpartyGroupMemberships.counterpartyId,
            uniqueIds,
          ),
        );
    },
    async deleteMembershipsByCounterpartyAndGroupIdsTx(tx, input) {
      const counterpartyIds = dedupeIds(input.counterpartyIds);
      const groupIds = dedupeIds(input.groupIds);
      if (counterpartyIds.length === 0 || groupIds.length === 0) {
        return;
      }

      await tx
        .delete(schema.counterpartyGroupMemberships)
        .where(
          and(
            inArray(
              schema.counterpartyGroupMemberships.counterpartyId,
              counterpartyIds,
            ),
            inArray(schema.counterpartyGroupMemberships.groupId, groupIds),
          ),
        );
    },
    async clearCounterpartyCustomerLinkTx(tx, counterpartyIds) {
      const uniqueIds = dedupeIds(counterpartyIds);
      if (uniqueIds.length === 0) {
        return;
      }

      await tx
        .update(schema.counterparties)
        .set({
          customerId: null,
          updatedAt: sql`now()`,
        })
        .where(inArray(schema.counterparties.id, uniqueIds));
    },
    async deleteCounterpartyGroupsByIdsTx(tx, groupIds) {
      const uniqueIds = dedupeIds(groupIds);
      if (uniqueIds.length === 0) {
        return;
      }

      await tx
        .delete(schema.counterpartyGroups)
        .where(inArray(schema.counterpartyGroups.id, uniqueIds));
    },
  };
}
