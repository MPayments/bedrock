import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import { dedupeIds } from "@bedrock/shared/core/domain";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  OrganizationsCommandRepository,
  OrganizationsQueryRepository,
} from "../../../application/organizations/ports";
import type { ListOrganizationsQuery, Organization } from "../../../contracts";
import type { PartyKind } from "../../../domain/party-kind";
import { schema } from "../schema";

const SORT_COLUMN_MAP = {
  shortName: schema.organizations.shortName,
  fullName: schema.organizations.fullName,
  country: schema.organizations.country,
  kind: schema.organizations.kind,
  createdAt: schema.organizations.createdAt,
  updatedAt: schema.organizations.updatedAt,
} as const;

function buildWhere(input: ListOrganizationsQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (input.shortName) {
    conditions.push(
      or(
        ilike(schema.organizations.shortName, `%${input.shortName}%`),
        ilike(schema.organizations.fullName, `%${input.shortName}%`),
      )!,
    );
  }

  if (input.fullName) {
    conditions.push(
      ilike(schema.organizations.fullName, `%${input.fullName}%`),
    );
  }

  if (input.country?.length) {
    conditions.push(inArray(schema.organizations.country, input.country));
  }

  if (input.kind?.length) {
    conditions.push(
      inArray(schema.organizations.kind, input.kind as PartyKind[]),
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
async function findOrganizationSnapshot(db: Queryable, id: string) {
  const [row] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, id))
    .limit(1);

  return row ?? null;
}

export function createDrizzleOrganizationsQueryRepository(
  db: Queryable,
): OrganizationsQueryRepository {
  return {
    async findOrganizationById(id) {
      return findOrganizationSnapshot(db, id);
    },
    async listOrganizations(input) {
      const where = buildWhere(input);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        SORT_COLUMN_MAP,
        schema.organizations.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(schema.organizations)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(schema.organizations)
          .where(where),
      ]);

      return {
        data: rows,
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<Organization>;
    },
    async listInternalLedgerOrganizations() {
      return db
        .select({
          id: schema.organizations.id,
          shortName: schema.organizations.shortName,
        })
        .from(schema.organizations)
        .orderBy(schema.organizations.shortName);
    },
    async listShortNamesById(ids) {
      const uniqueIds = dedupeIds(ids);

      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          id: schema.organizations.id,
          shortName: schema.organizations.shortName,
        })
        .from(schema.organizations)
        .where(inArray(schema.organizations.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.shortName]));
    },
    async listExistingOrganizationIds(ids) {
      const uniqueIds = dedupeIds(ids);

      if (uniqueIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(inArray(schema.organizations.id, uniqueIds));

      return rows.map((row) => row.id);
    },
  };
}

export function createDrizzleOrganizationsCommandRepository(
  db: Queryable,
): OrganizationsCommandRepository {
  return {
    async findOrganizationSnapshotById(id) {
      return findOrganizationSnapshot(db, id);
    },
    async insertOrganization(organization) {
      const [created] = await db
        .insert(schema.organizations)
        .values({
          id: organization.id,
          shortName: organization.shortName,
          fullName: organization.fullName,
          kind: organization.kind,
          country: organization.country,
          externalId: organization.externalId,
          description: organization.description,
        })
        .returning();

      return created!;
    },
    async updateOrganization(organization) {
      const [updated] = await db
        .update(schema.organizations)
        .set({
          shortName: organization.shortName,
          fullName: organization.fullName,
          kind: organization.kind,
          country: organization.country,
          externalId: organization.externalId,
          description: organization.description,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.organizations.id, organization.id))
        .returning();

      return updated ?? null;
    },
    async removeOrganization(id) {
      const [deleted] = await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, id))
        .returning({ id: schema.organizations.id });

      return Boolean(deleted);
    },
  };
}
