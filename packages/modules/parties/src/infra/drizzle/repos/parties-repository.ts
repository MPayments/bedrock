import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import { isUuidLike } from "@bedrock/shared/core/uuid";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  PartiesRepository,
  StoredCounterparty,
  StoredCounterpartyGroup,
} from "../../../application/ports";
import {
  CountryCodeSchema,
  CounterpartyKindSchema,
  type Counterparty,
  type CounterpartyGroup,
  type CreateCounterpartyInput,
  type CreateCustomerInput,
  type Customer,
  type ListCounterpartiesQuery,
  type ListCounterpartyGroupsQuery,
  type ListCustomersQuery,
  type UpdateCustomerInput,
} from "../../../contracts";
import {
  buildManagedCustomerGroupCode,
  dedupeIds,
  type GroupNode,
} from "../../../domain/group-rules";
import { schema } from "../schema";

const CUSTOMER_SORT_COLUMN_MAP = {
  displayName: schema.customers.displayName,
  externalRef: schema.customers.externalRef,
  createdAt: schema.customers.createdAt,
  updatedAt: schema.customers.updatedAt,
} as const;

const COUNTERPARTY_SORT_COLUMN_MAP = {
  shortName: schema.counterparties.shortName,
  fullName: schema.counterparties.fullName,
  country: schema.counterparties.country,
  kind: schema.counterparties.kind,
  createdAt: schema.counterparties.createdAt,
  updatedAt: schema.counterparties.updatedAt,
} as const;

function resolveDb(db: Queryable, queryable?: Queryable): Queryable {
  return queryable ?? db;
}

export function createDrizzlePartiesRepository(db: Queryable): PartiesRepository {
  return {
    async findCustomerById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, id))
        .limit(1);

      return row ?? null;
    },
    async listCustomers(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [];

      if (input.displayName) {
        conditions.push(ilike(schema.customers.displayName, `%${input.displayName}%`));
      }

      if (input.externalRef) {
        conditions.push(ilike(schema.customers.externalRef, `%${input.externalRef}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
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
    async insertCustomerTx(tx, input) {
      const [created] = await tx
        .insert(schema.customers)
        .values({
          externalRef: input.externalRef ?? null,
          displayName: input.displayName,
          description: input.description ?? null,
        })
        .returning();

      return created!;
    },
    async updateCustomerTx(tx, id, input) {
      const fields: Record<string, unknown> = {};
      if (input.externalRef !== undefined) {
        fields.externalRef = input.externalRef;
      }
      if (input.displayName !== undefined) {
        fields.displayName = input.displayName;
      }
      if (input.description !== undefined) {
        fields.description = input.description;
      }
      if (Object.keys(fields).length === 0) {
        return this.findCustomerById(id, tx);
      }

      fields.updatedAt = sql`now()`;

      const [updated] = await tx
        .update(schema.customers)
        .set(fields)
        .where(eq(schema.customers.id, id))
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
    async listCustomerDisplayNamesById(ids, queryable) {
      const uniqueIds = dedupeIds(ids);
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await resolveDb(db, queryable)
        .select({
          id: schema.customers.id,
          displayName: schema.customers.displayName,
        })
        .from(schema.customers)
        .where(inArray(schema.customers.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.displayName]));
    },
    async listExistingCustomerIds(ids, queryable) {
      const uniqueIds = dedupeIds(ids);
      if (uniqueIds.length === 0) {
        return [];
      }

      const rows = await resolveDb(db, queryable)
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(inArray(schema.customers.id, uniqueIds));

      return rows.map((row) => row.id);
    },
    async findManagedCustomerGroup(customerId, queryable) {
      const [row] = await resolveDb(db, queryable)
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
    },
    async ensureManagedCustomerGroupTx(tx, input) {
      const existing = await this.findManagedCustomerGroup(input.customerId, tx);
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

      const created = await this.findManagedCustomerGroup(input.customerId, tx);
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
    async listCounterpartiesByCustomerId(customerId, queryable) {
      return resolveDb(db, queryable)
        .select({ id: schema.counterparties.id })
        .from(schema.counterparties)
        .where(eq(schema.counterparties.customerId, customerId));
    },
    async listGroupNodes(queryable) {
      const rows = await resolveDb(db, queryable)
        .select({
          id: schema.counterpartyGroups.id,
          code: schema.counterpartyGroups.code,
          parentId: schema.counterpartyGroups.parentId,
          customerId: schema.counterpartyGroups.customerId,
        })
        .from(schema.counterpartyGroups);

      return rows satisfies GroupNode[];
    },
    async listMembershipRowsByCounterpartyIds(counterpartyIds, queryable) {
      const uniqueIds = dedupeIds(counterpartyIds);
      if (uniqueIds.length === 0) {
        return [];
      }

      return resolveDb(db, queryable)
        .select({
          counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
          groupId: schema.counterpartyGroupMemberships.groupId,
        })
        .from(schema.counterpartyGroupMemberships)
        .where(
          inArray(schema.counterpartyGroupMemberships.counterpartyId, uniqueIds),
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
    async findCounterpartyById(id, queryable) {
      const database = resolveDb(db, queryable);
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
        groupIds: await this.readMembershipIds(id, database),
      };
    },
    async listCounterparties(input, queryable) {
      const database = resolveDb(db, queryable);
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

      const countries = input.country?.map((value) => CountryCodeSchema.parse(value));
      if (countries?.length) {
        conditions.push(inArray(schema.counterparties.country, countries));
      }

      const kinds = input.kind?.map((value) => CounterpartyKindSchema.parse(value));
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
            inArray(schema.counterpartyGroupMemberships.groupId, selectedGroupIds),
          )
          .groupBy(schema.counterpartyGroupMemberships.counterpartyId);

        const matchingCounterpartyIds = matchingRows.map(
          (row) => row.counterpartyId,
        );

        if (matchingCounterpartyIds.length === 0) {
          return emptyResult;
        }

        conditions.push(inArray(schema.counterparties.id, matchingCounterpartyIds));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
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

      const membershipMap = await this.readMembershipMap(
        rows.map((row) => row.id),
        database,
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
    async insertCounterpartyTx(tx, input) {
      const [created] = await tx
        .insert(schema.counterparties)
        .values({
          shortName: input.shortName,
          fullName: input.fullName,
          kind: input.kind,
          country: input.country ?? null,
          externalId: input.externalId ?? null,
          description: input.description ?? null,
          customerId: input.customerId,
        })
        .returning();

      return created!;
    },
    async updateCounterpartyTx(tx, id, input) {
      if (Object.keys(input).length === 0) {
        const existing = await this.findCounterpartyById(id, tx);
        if (!existing) {
          return null;
        }

        const { groupIds: _groupIds, ...stored } = existing;
        return stored;
      }

      const [updated] = await tx
        .update(schema.counterparties)
        .set({
          ...input,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterparties.id, id))
        .returning();

      return updated ?? null;
    },
    async removeCounterparty(id) {
      const [deleted] = await db
        .delete(schema.counterparties)
        .where(eq(schema.counterparties.id, id))
        .returning({ id: schema.counterparties.id });

      return Boolean(deleted);
    },
    async readMembershipIds(counterpartyId, queryable) {
      const rows = await resolveDb(db, queryable)
        .select({ groupId: schema.counterpartyGroupMemberships.groupId })
        .from(schema.counterpartyGroupMemberships)
        .where(eq(schema.counterpartyGroupMemberships.counterpartyId, counterpartyId));

      return rows.map((row) => row.groupId);
    },
    async readMembershipMap(counterpartyIds, queryable) {
      const uniqueIds = dedupeIds(counterpartyIds);
      const map = new Map<string, string[]>();
      if (uniqueIds.length === 0) {
        return map;
      }

      const rows = await resolveDb(db, queryable)
        .select({
          counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
          groupId: schema.counterpartyGroupMemberships.groupId,
        })
        .from(schema.counterpartyGroupMemberships)
        .where(
          inArray(schema.counterpartyGroupMemberships.counterpartyId, uniqueIds),
        );

      for (const row of rows) {
        const groupIds = map.get(row.counterpartyId);
        if (groupIds) {
          groupIds.push(row.groupId);
          continue;
        }

        map.set(row.counterpartyId, [row.groupId]);
      }

      return map;
    },
    async replaceMembershipsTx(tx, counterpartyId, groupIds) {
      const uniqueGroupIds = dedupeIds(groupIds);

      await tx
        .delete(schema.counterpartyGroupMemberships)
        .where(eq(schema.counterpartyGroupMemberships.counterpartyId, counterpartyId));

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
    async listCounterpartyShortNamesById(ids, queryable) {
      const uniqueIds = dedupeIds(ids);
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await resolveDb(db, queryable)
        .select({
          id: schema.counterparties.id,
          shortName: schema.counterparties.shortName,
        })
        .from(schema.counterparties)
        .where(inArray(schema.counterparties.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.shortName]));
    },
    async listGroupMembers(input, queryable) {
      const uniqueGroupIds = dedupeIds(input.groupIds);
      if (uniqueGroupIds.length === 0) {
        return [];
      }

      const database = resolveDb(db, queryable);
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

        return ((result.rows ?? []) as {
          root_group_id: string;
          counterparty_id: string;
        }[]).map((row) => ({
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

      return ((result.rows ?? []) as {
        root_group_id: string;
        counterparty_id: string;
      }[]).map((row) => ({
        rootGroupId: row.root_group_id,
        counterpartyId: row.counterparty_id,
      }));
    },
    async listCounterpartyGroups(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [];

      if (input.parentId) {
        conditions.push(eq(schema.counterpartyGroups.parentId, input.parentId));
      }

      if (input.customerId) {
        conditions.push(eq(schema.counterpartyGroups.customerId, input.customerId));
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
    async findCounterpartyGroupById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(schema.counterpartyGroups)
        .where(eq(schema.counterpartyGroups.id, id))
        .limit(1);

      return row ?? null;
    },
    async insertCounterpartyGroup(input, queryable) {
      const [created] = await resolveDb(db, queryable)
        .insert(schema.counterpartyGroups)
        .values(input)
        .returning();

      return created!;
    },
    async updateCounterpartyGroup(id, input, queryable) {
      const [updated] = await resolveDb(db, queryable)
        .update(schema.counterpartyGroups)
        .set({
          ...input,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterpartyGroups.id, id))
        .returning();

      return updated ?? null;
    },
    async reparentCounterpartyChildrenTx(tx, input) {
      await tx
        .update(schema.counterpartyGroups)
        .set({ parentId: input.parentId })
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
}
