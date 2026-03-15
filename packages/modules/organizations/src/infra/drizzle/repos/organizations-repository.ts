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

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";

import type { OrganizationsRepository } from "../../../application/ports";
import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  UpdateOrganizationInput,
} from "../../../contracts";
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

export function createDrizzleOrganizationsRepository(
  db: Queryable,
): OrganizationsRepository {
  return {
    async insertOrganizationTx(
      tx: Transaction,
      input: CreateOrganizationInput,
    ) {
      const [created] = await tx
        .insert(schema.organizations)
        .values({
          shortName: input.shortName,
          fullName: input.fullName,
          kind: input.kind,
          country: input.country ?? null,
          externalId: input.externalId ?? null,
          description: input.description ?? null,
        })
        .returning();

      return created!;
    },
    async findOrganizationById(id: string) {
      const [row] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, id))
        .limit(1);

      return row ?? null;
    },
    async listOrganizations(input: ListOrganizationsQuery) {
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
      };
    },
    async updateOrganization(id: string, input: UpdateOrganizationInput) {
      const fields: Record<string, unknown> = {};

      if (input.shortName !== undefined) {
        fields.shortName = input.shortName;
      }

      if (input.fullName !== undefined) {
        fields.fullName = input.fullName;
      }

      if (input.kind !== undefined) {
        fields.kind = input.kind;
      }

      if (input.country !== undefined) {
        fields.country = input.country;
      }

      if (input.externalId !== undefined) {
        fields.externalId = input.externalId;
      }

      if (input.description !== undefined) {
        fields.description = input.description;
      }

      if (Object.keys(fields).length === 0) {
        return this.findOrganizationById(id);
      }

      fields.updatedAt = sql`now()`;

      const [updated] = await db
        .update(schema.organizations)
        .set(fields)
        .where(eq(schema.organizations.id, id))
        .returning();

      return updated ?? null;
    },
    async removeOrganization(id: string) {
      const [deleted] = await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, id))
        .returning({ id: schema.organizations.id });

      return Boolean(deleted);
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
    async listShortNamesById(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
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
    async listExistingOrganizationIds(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
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
