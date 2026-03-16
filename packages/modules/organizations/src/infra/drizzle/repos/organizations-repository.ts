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

import type { Database, Transaction } from "@bedrock/platform/persistence";
import { dedupeIds } from "@bedrock/shared/core/domain";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type { OrganizationsQueryRepository } from "../../../application/organizations/ports";
import type { ListOrganizationsQuery, Organization } from "../../../contracts";
import type { OrganizationSnapshot } from "../../../domain/organization";
import type { PartyKind } from "../../../domain/party-kind";
import { schema, type OrganizationRow } from "../schema";

const SORT_COLUMN_MAP = {
  shortName: schema.organizations.shortName,
  fullName: schema.organizations.fullName,
  country: schema.organizations.country,
  kind: schema.organizations.kind,
  createdAt: schema.organizations.createdAt,
  updatedAt: schema.organizations.updatedAt,
} as const;

function toSnapshot(row: OrganizationRow): OrganizationSnapshot {
  return row;
}

function toPublicOrganization(snapshot: OrganizationSnapshot): Organization {
  return snapshot;
}

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

interface DrizzleOrganizationsCommandRepository {
  findOrganizationSnapshotById: (
    id: string,
    tx?: Transaction,
  ) => Promise<OrganizationSnapshot | null>;
  insertOrganizationTx: (
    tx: Transaction,
    organization: OrganizationSnapshot,
  ) => Promise<OrganizationSnapshot>;
  updateOrganizationTx: (
    tx: Transaction,
    organization: OrganizationSnapshot,
  ) => Promise<OrganizationSnapshot | null>;
  removeOrganizationTx: (tx: Transaction, id: string) => Promise<boolean>;
}

async function findOrganizationSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<OrganizationSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, id))
    .limit(1);

  return row ? toSnapshot(row) : null;
}

export function createDrizzleOrganizationsQueryRepository(
  db: Database,
): OrganizationsQueryRepository {
  return {
    async findOrganizationById(id) {
      const snapshot = await findOrganizationSnapshot(db, id);
      return snapshot ? toPublicOrganization(snapshot) : null;
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
        data: rows.map((row) => toPublicOrganization(toSnapshot(row))),
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
  db: Database,
) {
  const repository: DrizzleOrganizationsCommandRepository = {
    async findOrganizationSnapshotById(id, tx) {
      return findOrganizationSnapshot(db, id, tx);
    },
    async insertOrganizationTx(tx, organization) {
      const [created] = await tx
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

      return toSnapshot(created!);
    },
    async updateOrganizationTx(tx, organization) {
      const [updated] = await tx
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

      return updated ? toSnapshot(updated) : null;
    },
    async removeOrganizationTx(tx, id) {
      const [deleted] = await tx
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, id))
        .returning({ id: schema.organizations.id });

      return Boolean(deleted);
    },
  };

  return repository;
}
