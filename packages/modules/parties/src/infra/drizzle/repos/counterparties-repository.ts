import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";
import { dedupeIds } from "@bedrock/shared/core/domain";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";
import { isUuidLike } from "@bedrock/shared/core/uuid";

import type {
  CounterpartiesQueryRepository,
} from "../../../application/counterparties/ports";
import type { Counterparty } from "../../../contracts";
import { CountryCodeSchema, CounterpartyKindSchema } from "../../../contracts";
import type { CounterpartySnapshot } from "../../../domain/counterparty";
import type { GroupHierarchyNodeSnapshot } from "../../../domain/group-hierarchy";
import { schema } from "../schema";
import { readMembershipIds, readMembershipMap } from "./shared";

const COUNTERPARTY_SORT_COLUMN_MAP = {
  shortName: schema.counterparties.shortName,
  fullName: schema.counterparties.fullName,
  country: schema.counterparties.country,
  kind: schema.counterparties.kind,
  createdAt: schema.counterparties.createdAt,
  updatedAt: schema.counterparties.updatedAt,
} as const;

interface DrizzleCounterpartiesCommandRepository {
  findCounterpartySnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<CounterpartySnapshot | null>;
  insertCounterpartyTx: (
    tx: Transaction,
    counterparty: CounterpartySnapshot,
  ) => Promise<CounterpartySnapshot>;
  updateCounterpartyTx: (
    tx: Transaction,
    counterparty: CounterpartySnapshot,
  ) => Promise<CounterpartySnapshot | null>;
  removeCounterparty: (id: string) => Promise<boolean>;
  replaceMembershipsTx: (
    tx: Transaction,
    counterpartyId: string,
    groupIds: string[],
  ) => Promise<void>;
  listGroupHierarchyNodes: (
    tx?: Transaction,
  ) => Promise<GroupHierarchyNodeSnapshot[]>;
}

async function findCounterpartySnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<CounterpartySnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(schema.counterparties)
    .where(eq(schema.counterparties.id, id))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...row,
    groupIds: await readMembershipIds(db, id, tx),
  } satisfies CounterpartySnapshot;
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

export function createDrizzleCounterpartiesQueryRepository(
  db: Database,
): CounterpartiesQueryRepository {
  return {
    async findCounterpartyById(id) {
      return findCounterpartySnapshot(db, id);
    },
    async listCounterparties(input) {
      const database = db;
      const conditions: SQL[] = [];
      const emptyResult = {
        data: [],
        total: 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<Counterparty>;

      if (input.customerId) {
        if (!isUuidLike(input.customerId)) {
          return emptyResult;
        }

        conditions.push(eq(schema.counterparties.customerId, input.customerId));
      }

      if (input.externalId) {
        conditions.push(eq(schema.counterparties.externalId, input.externalId));
      }

      if (input.shortName) {
        conditions.push(
          ilike(schema.counterparties.shortName, `%${input.shortName}%`),
        );
      }

      if (input.fullName) {
        conditions.push(
          ilike(schema.counterparties.fullName, `%${input.fullName}%`),
        );
      }

      const countries = input.country?.map((value) =>
        CountryCodeSchema.parse(value),
      );
      if (countries?.length) {
        conditions.push(inArray(schema.counterparties.country, countries));
      }

      const kinds = input.kind?.map((value) =>
        CounterpartyKindSchema.parse(value),
      );
      if (kinds?.length) {
        conditions.push(inArray(schema.counterparties.kind, kinds));
      }

      const selectedGroupIds = dedupeIds(
        (input.groupIds ?? []).filter((value) => isUuidLike(value)),
      );
      if (input.groupIds?.length && selectedGroupIds.length === 0) {
        return emptyResult;
      }

      if (selectedGroupIds.length > 0) {
        const matchingRows = await database
          .select({
            counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
          })
          .from(schema.counterpartyGroupMemberships)
          .where(
            inArray(
              schema.counterpartyGroupMemberships.groupId,
              selectedGroupIds,
            ),
          )
          .groupBy(schema.counterpartyGroupMemberships.counterpartyId);

        const matchingCounterpartyIds = matchingRows.map(
          (row) => row.counterpartyId,
        );

        if (matchingCounterpartyIds.length === 0) {
          return emptyResult;
        }

        conditions.push(
          inArray(schema.counterparties.id, matchingCounterpartyIds),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByColumn = resolveSortValue(
        input.sortBy,
        COUNTERPARTY_SORT_COLUMN_MAP,
        schema.counterparties.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(schema.counterparties)
          .where(where)
          .orderBy(orderByFn(orderByColumn))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(schema.counterparties)
          .where(where),
      ]);

      const membershipMap = await readMembershipMap(
        database,
        rows.map((row) => row.id),
      );

      return {
        data: rows.map((row) => ({
          ...row,
          groupIds: membershipMap.get(row.id) ?? [],
        })),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<Counterparty>;
    },
    async listCounterpartyShortNamesById(ids) {
      const uniqueIds = dedupeIds(ids);
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const database = db;
      const rows = await database
        .select({
          id: schema.counterparties.id,
          shortName: schema.counterparties.shortName,
        })
        .from(schema.counterparties)
        .where(inArray(schema.counterparties.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.shortName]));
    },
    async listGroupMembers(input) {
      const uniqueGroupIds = dedupeIds(input.groupIds);
      if (uniqueGroupIds.length === 0) {
        return [];
      }

      const database = db;
      const groupIdsSql = sql.join(
        uniqueGroupIds.map((id) => sql`${id}`),
        sql`, `,
      );

      if (!input.includeDescendants) {
        const result = await database.execute(sql`
          WITH selected_groups AS (
            SELECT g.id AS root_group_id
            FROM ${schema.counterpartyGroups} g
            WHERE g.id IN (${groupIdsSql})
          )
          SELECT DISTINCT
            sg.root_group_id,
            m.counterparty_id
          FROM selected_groups sg
          INNER JOIN ${schema.counterpartyGroupMemberships} m
            ON m.group_id = sg.root_group_id
        `);

        return (
          (result.rows ?? []) as {
            root_group_id: string;
            counterparty_id: string;
          }[]
        ).map((row) => ({
          rootGroupId: row.root_group_id,
          counterpartyId: row.counterparty_id,
        }));
      }

      const result = await database.execute(sql`
        WITH RECURSIVE selected_groups AS (
          SELECT g.id AS root_group_id, g.id AS group_id
          FROM ${schema.counterpartyGroups} g
          WHERE g.id IN (${groupIdsSql})
        ),
        group_tree AS (
          SELECT root_group_id, group_id
          FROM selected_groups
          UNION ALL
          SELECT gt.root_group_id, child.id
          FROM group_tree gt
          INNER JOIN ${schema.counterpartyGroups} child
            ON child.parent_id = gt.group_id
        )
        SELECT DISTINCT
          gt.root_group_id,
          m.counterparty_id
        FROM group_tree gt
        INNER JOIN ${schema.counterpartyGroupMemberships} m
          ON m.group_id = gt.group_id
      `);

      return (
        (result.rows ?? []) as {
          root_group_id: string;
          counterparty_id: string;
        }[]
      ).map((row) => ({
        rootGroupId: row.root_group_id,
        counterpartyId: row.counterparty_id,
      }));
    },
  };
}

export function createDrizzleCounterpartiesCommandRepository(
  db: Database,
) {
  const repository: DrizzleCounterpartiesCommandRepository = {
    async findCounterpartySnapshotById(id, tx) {
      return findCounterpartySnapshot(db, id, tx);
    },
    async insertCounterpartyTx(tx, counterparty) {
      const [created] = await tx
        .insert(schema.counterparties)
        .values({
          id: counterparty.id,
          shortName: counterparty.shortName,
          fullName: counterparty.fullName,
          kind: counterparty.kind,
          country: counterparty.country,
          externalId: counterparty.externalId,
          description: counterparty.description,
          customerId: counterparty.customerId,
        })
        .returning();

      return {
        ...created!,
        groupIds: [],
      } satisfies CounterpartySnapshot;
    },
    async updateCounterpartyTx(tx, counterparty) {
      const [updated] = await tx
        .update(schema.counterparties)
        .set({
          shortName: counterparty.shortName,
          fullName: counterparty.fullName,
          kind: counterparty.kind,
          country: counterparty.country,
          externalId: counterparty.externalId,
          description: counterparty.description,
          customerId: counterparty.customerId,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterparties.id, counterparty.id))
        .returning();

      return updated
        ? {
            ...updated,
            groupIds: counterparty.groupIds,
          }
        : null;
    },
    async removeCounterparty(id) {
      const [deleted] = await db
        .delete(schema.counterparties)
        .where(eq(schema.counterparties.id, id))
        .returning({ id: schema.counterparties.id });

      return Boolean(deleted);
    },
    async replaceMembershipsTx(tx, counterpartyId, groupIds) {
      const uniqueGroupIds = dedupeIds(groupIds);

      await tx
        .delete(schema.counterpartyGroupMemberships)
        .where(
          eq(
            schema.counterpartyGroupMemberships.counterpartyId,
            counterpartyId,
          ),
        );

      if (uniqueGroupIds.length === 0) {
        return;
      }

      await tx.insert(schema.counterpartyGroupMemberships).values(
        uniqueGroupIds.map((groupId) => ({
          counterpartyId,
          groupId,
        })),
      );
    },
    async listGroupHierarchyNodes(tx) {
      return listGroupHierarchyNodes(db, tx);
    },
  };

  return repository;
}
