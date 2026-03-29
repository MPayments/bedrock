import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import { dedupeStrings as dedupeIds } from "@bedrock/shared/core/domain";
import type { PaginatedList } from "@bedrock/shared/core/pagination";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";
import { isUuidLike } from "@bedrock/shared/core/uuid";

import { counterpartyGroupMemberships, counterparties } from "./schema";
import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import {
  CounterpartyRelationshipKindSchema,
} from "../../domain/relationship-kind";
import type { Counterparty } from "../../application/contracts/counterparty.dto";
import type { ListCounterpartiesQuery } from "../../application/contracts/counterparty.queries";
import type { CounterpartyReads } from "../../application/ports/counterparty.reads";

const COUNTERPARTY_SORT_COLUMN_MAP = {
  shortName: counterparties.shortName,
  fullName: counterparties.fullName,
  relationshipKind: counterparties.relationshipKind,
  country: counterparties.country,
  kind: counterparties.kind,
  createdAt: counterparties.createdAt,
  updatedAt: counterparties.updatedAt,
} as const;

export class DrizzleCounterpartyReads implements CounterpartyReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Counterparty | null> {
    const [row] = await this.db
      .select()
      .from(counterparties)
      .where(eq(counterparties.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      ...row,
      groupIds: await this.readMembershipIds(id),
    };
  }

  async list(input: ListCounterpartiesQuery): Promise<PaginatedList<Counterparty>> {
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

      conditions.push(eq(counterparties.customerId, input.customerId));
    }

    if (input.externalId) {
      conditions.push(eq(counterparties.externalId, input.externalId));
    }

    const relationshipKinds = input.relationshipKind?.map((value) =>
      CounterpartyRelationshipKindSchema.parse(value),
    );
    if (relationshipKinds?.length) {
      conditions.push(
        inArray(counterparties.relationshipKind, relationshipKinds),
      );
    }

    if (input.shortName) {
      conditions.push(ilike(counterparties.shortName, `%${input.shortName}%`));
    }

    if (input.fullName) {
      conditions.push(ilike(counterparties.fullName, `%${input.fullName}%`));
    }

    const countries = input.country?.map((value) => CountryCodeSchema.parse(value));
    if (countries?.length) {
      conditions.push(inArray(counterparties.country, countries));
    }

    const kinds = input.kind?.map((value) => PartyKindSchema.parse(value));
    if (kinds?.length) {
      conditions.push(inArray(counterparties.kind, kinds));
    }

    const selectedGroupIds = dedupeIds(
      (input.groupIds ?? []).filter((value) => isUuidLike(value)),
    );
    if (input.groupIds?.length && selectedGroupIds.length === 0) {
      return emptyResult;
    }

    if (selectedGroupIds.length > 0) {
      const matchingRows = await this.db
        .select({
          counterpartyId: counterpartyGroupMemberships.counterpartyId,
        })
        .from(counterpartyGroupMemberships)
        .where(inArray(counterpartyGroupMemberships.groupId, selectedGroupIds))
        .groupBy(counterpartyGroupMemberships.counterpartyId);

      const matchingCounterpartyIds = matchingRows.map(
        (row) => row.counterpartyId,
      );
      if (matchingCounterpartyIds.length === 0) {
        return emptyResult;
      }

      conditions.push(inArray(counterparties.id, matchingCounterpartyIds));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      COUNTERPARTY_SORT_COLUMN_MAP,
      counterparties.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(counterparties)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(counterparties)
        .where(where),
    ]);

    const membershipMap = await this.readMembershipMap(rows.map((row) => row.id));

    return {
      data: rows.map((row) => ({
        ...row,
        groupIds: membershipMap.get(row.id) ?? [],
      })),
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  private async readMembershipIds(counterpartyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ groupId: counterpartyGroupMemberships.groupId })
      .from(counterpartyGroupMemberships)
      .where(eq(counterpartyGroupMemberships.counterpartyId, counterpartyId))
      .orderBy(
        asc(counterpartyGroupMemberships.createdAt),
        asc(counterpartyGroupMemberships.groupId),
      );

    return rows.map((row) => row.groupId);
  }

  private async readMembershipMap(
    counterpartyIds: string[],
  ): Promise<Map<string, string[]>> {
    const uniqueIds = dedupeIds(counterpartyIds);
    const map = new Map<string, string[]>();

    if (uniqueIds.length === 0) {
      return map;
    }

    const rows = await this.db
      .select({
        counterpartyId: counterpartyGroupMemberships.counterpartyId,
        groupId: counterpartyGroupMemberships.groupId,
      })
      .from(counterpartyGroupMemberships)
      .where(inArray(counterpartyGroupMemberships.counterpartyId, uniqueIds))
      .orderBy(
        asc(counterpartyGroupMemberships.createdAt),
        asc(counterpartyGroupMemberships.groupId),
      );

    for (const row of rows) {
      const groupIds = map.get(row.counterpartyId);
      if (groupIds) {
        groupIds.push(row.groupId);
      } else {
        map.set(row.counterpartyId, [row.groupId]);
      }
    }

    return map;
  }
}
