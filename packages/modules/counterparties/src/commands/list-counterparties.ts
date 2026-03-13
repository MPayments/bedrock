import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/counterparties/schema";
import { isUuidLike } from "@bedrock/core/uuid";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/core/pagination";

import type { CounterpartiesServiceContext } from "../internal/context";
import { readMembershipMap } from "../internal/group-rules";
import {
  CountryCodeSchema,
  CounterpartyGroupRootCodeSchema,
  CounterpartyKindSchema,
  ListCounterpartiesQuerySchema,
  type Counterparty,
  type ListCounterpartiesQuery,
} from "../validation";

const SORT_COLUMN_MAP = {
  shortName: schema.counterparties.shortName,
  fullName: schema.counterparties.fullName,
  country: schema.counterparties.country,
  kind: schema.counterparties.kind,
  createdAt: schema.counterparties.createdAt,
  updatedAt: schema.counterparties.updatedAt,
} as const;

export function createListCounterpartiesHandler(
  context: CounterpartiesServiceContext,
) {
  const { db } = context;

  return async function listCounterparties(
    input?: ListCounterpartiesQuery,
  ): Promise<PaginatedList<Counterparty>> {
    const query = ListCounterpartiesQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      customerId,
      shortName,
      fullName,
      country,
      kind,
      groupIds,
      groupRoot,
    } = query;

    const conditions: SQL[] = [];
    const emptyResult = {
      data: [],
      total: 0,
      limit,
      offset,
    } satisfies PaginatedList<Counterparty>;

    if (customerId) {
      if (!isUuidLike(customerId)) {
        return emptyResult;
      }

      conditions.push(eq(schema.counterparties.customerId, customerId));
    }

    if (shortName) {
      conditions.push(ilike(schema.counterparties.shortName, `%${shortName}%`));
    }

    if (fullName) {
      conditions.push(ilike(schema.counterparties.fullName, `%${fullName}%`));
    }

    const countries = country?.map((value) => CountryCodeSchema.parse(value));
    if (countries?.length) {
      conditions.push(inArray(schema.counterparties.country, countries));
    }

    const kinds = kind?.map((value) => CounterpartyKindSchema.parse(value));
    if (kinds?.length) {
      conditions.push(inArray(schema.counterparties.kind, kinds));
    }

    const selectedGroupIds = Array.from(
      new Set((groupIds ?? []).filter((value) => isUuidLike(value))),
    );
    if (groupIds?.length && selectedGroupIds.length === 0) {
      return emptyResult;
    }
    if (selectedGroupIds.length > 0) {
      const matchingRows = await db
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

    const groupRoots = groupRoot?.map((value) =>
      CounterpartyGroupRootCodeSchema.parse(value),
    );
    if (groupRoots?.length) {
      const groups = await db
        .select({
          id: schema.counterpartyGroups.id,
          parentId: schema.counterpartyGroups.parentId,
          code: schema.counterpartyGroups.code,
        })
        .from(schema.counterpartyGroups);
      const groupById = new Map(groups.map((group) => [group.id, group]));

      const rootCodeByGroupId = new Map<string, string>();
      const resolveRootCode = (groupId: string): string | null => {
        const cached = rootCodeByGroupId.get(groupId);
        if (cached) {
          return cached;
        }

        const visited = new Set<string>();
        let cursor = groupById.get(groupId);
        while (cursor) {
          if (visited.has(cursor.id)) {
            return null;
          }
          visited.add(cursor.id);

          if (!cursor.parentId) {
            rootCodeByGroupId.set(groupId, cursor.code);
            return cursor.code;
          }
          cursor = groupById.get(cursor.parentId);
        }

        return null;
      };

      const matchingRows = await db
        .select({
          counterpartyId: schema.counterpartyGroupMemberships.counterpartyId,
          groupId: schema.counterpartyGroupMemberships.groupId,
        })
        .from(schema.counterpartyGroupMemberships)
        .groupBy(
          schema.counterpartyGroupMemberships.counterpartyId,
          schema.counterpartyGroupMemberships.groupId,
        );

      const matchingCounterpartyIds = Array.from(
        new Set(
          matchingRows
            .filter((row) => {
              const rootCode = resolveRootCode(row.groupId);
              return rootCode
                ? groupRoots.includes(rootCode as "treasury" | "customers")
                : false;
            })
            .map((row) => row.counterpartyId),
        ),
      );
      if (matchingCounterpartyIds.length === 0) {
        return emptyResult;
      }

      conditions.push(
        inArray(schema.counterparties.id, matchingCounterpartyIds),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.counterparties.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.counterparties)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.counterparties)
        .where(where),
    ]);

    const membershipMap = await readMembershipMap(
      db,
      rows.map((row) => row.id),
    );

    return {
      data: rows.map((row) => ({
        ...row,
        groupIds: membershipMap.get(row.id) ?? [],
      })),
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
