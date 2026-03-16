import { and, asc, eq, sql, type SQL } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  CounterpartyGroupsQueryRepository,
} from "../../../application/groups/ports";
import type { CounterpartyGroupSnapshot } from "../../../domain/counterparty-group";
import type { GroupHierarchyNodeSnapshot } from "../../../domain/group-hierarchy";
import { schema } from "../schema";

interface DrizzleCounterpartyGroupsCommandRepository {
  findCounterpartyGroupSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<CounterpartyGroupSnapshot | null>;
  insertCounterpartyGroup: (
    group: CounterpartyGroupSnapshot,
  ) => Promise<CounterpartyGroupSnapshot>;
  updateCounterpartyGroup: (
    group: CounterpartyGroupSnapshot,
  ) => Promise<CounterpartyGroupSnapshot | null>;
  listGroupHierarchyNodes: (
    tx?: Transaction,
  ) => Promise<GroupHierarchyNodeSnapshot[]>;
  reparentCounterpartyChildrenTx: (
    tx: Transaction,
    input: {
      id: string;
      parentId: string | null;
    },
  ) => Promise<void>;
  removeCounterpartyGroupTx: (tx: Transaction, id: string) => Promise<boolean>;
}

async function findCounterpartyGroupSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
) {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(schema.counterpartyGroups)
    .where(eq(schema.counterpartyGroups.id, id))
    .limit(1);

  return row ?? null;
}

async function listGroupHierarchyNodes(
  db: Database,
  tx?: Transaction,
): Promise<GroupHierarchyNodeSnapshot[]> {
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
}

export function createDrizzleCounterpartyGroupsQueryRepository(
  db: Database,
): CounterpartyGroupsQueryRepository {
  return {
    async listCounterpartyGroups(input) {
      const database = db;
      const conditions: SQL[] = [];

      if (input.parentId) {
        conditions.push(eq(schema.counterpartyGroups.parentId, input.parentId));
      }

      if (input.customerId) {
        conditions.push(
          eq(schema.counterpartyGroups.customerId, input.customerId),
        );
      }

      if (input.includeSystem === false) {
        conditions.push(eq(schema.counterpartyGroups.isSystem, false));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return database
        .select({
          id: schema.counterpartyGroups.id,
          code: schema.counterpartyGroups.code,
          name: schema.counterpartyGroups.name,
          description: schema.counterpartyGroups.description,
          parentId: schema.counterpartyGroups.parentId,
          customerId: schema.counterpartyGroups.customerId,
          customerLabel: schema.customers.displayName,
          isSystem: schema.counterpartyGroups.isSystem,
          createdAt: schema.counterpartyGroups.createdAt,
          updatedAt: schema.counterpartyGroups.updatedAt,
        })
        .from(schema.counterpartyGroups)
        .leftJoin(
          schema.customers,
          eq(schema.counterpartyGroups.customerId, schema.customers.id),
        )
        .where(where)
        .orderBy(asc(schema.counterpartyGroups.name));
    },
  };
}

export function createDrizzleCounterpartyGroupsCommandRepository(
  db: Database,
) {
  const repository: DrizzleCounterpartyGroupsCommandRepository = {
    async findCounterpartyGroupSnapshotById(id, tx) {
      return findCounterpartyGroupSnapshot(db, id, tx);
    },
    async insertCounterpartyGroup(group) {
      const database = db;
      const [created] = await database
        .insert(schema.counterpartyGroups)
        .values({
          id: group.id,
          code: group.code,
          name: group.name,
          description: group.description,
          parentId: group.parentId,
          customerId: group.customerId,
          isSystem: group.isSystem,
        })
        .returning();

      return created!;
    },
    async updateCounterpartyGroup(group) {
      const database = db;
      const [updated] = await database
        .update(schema.counterpartyGroups)
        .set({
          code: group.code,
          name: group.name,
          description: group.description,
          parentId: group.parentId,
          customerId: group.customerId,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterpartyGroups.id, group.id))
        .returning();

      return updated ?? null;
    },
    async listGroupHierarchyNodes(tx) {
      return listGroupHierarchyNodes(db, tx);
    },
    async reparentCounterpartyChildrenTx(tx, input) {
      await tx
        .update(schema.counterpartyGroups)
        .set({
          parentId: input.parentId,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterpartyGroups.parentId, input.id));
    },
    async removeCounterpartyGroupTx(tx, id) {
      const [deleted] = await tx
        .delete(schema.counterpartyGroups)
        .where(eq(schema.counterpartyGroups.id, id))
        .returning({ id: schema.counterpartyGroups.id });

      return Boolean(deleted);
    },
  };

  return repository;
}
