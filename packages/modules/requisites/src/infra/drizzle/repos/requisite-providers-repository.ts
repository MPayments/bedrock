import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  RequisiteProvidersCommandRepository,
  RequisiteProvidersQueryRepository,
} from "../../../application/providers/ports";
import type { RequisiteProvider } from "../../../contracts";
import { requisiteProviders, type RequisiteProviderRow } from "../schema";

const PROVIDERS_SORT_COLUMN_MAP = {
  name: requisiteProviders.name,
  kind: requisiteProviders.kind,
  country: requisiteProviders.country,
  createdAt: requisiteProviders.createdAt,
  updatedAt: requisiteProviders.updatedAt,
} as const;

function toPublicProvider(row: RequisiteProviderRow): RequisiteProvider {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    country: row.country,
    address: row.address,
    contact: row.contact,
    bic: row.bic,
    swift: row.swift,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleRequisiteProvidersQueryRepository(
  db: Queryable,
): RequisiteProvidersQueryRepository {
  return {
    async findProviderById(id) {
      const [row] = await db
        .select()
        .from(requisiteProviders)
        .where(eq(requisiteProviders.id, id))
        .limit(1);

      return row ? toPublicProvider(row) : null;
    },
    async findActiveProviderById(id) {
      const [row] = await db
        .select()
        .from(requisiteProviders)
        .where(
          and(
            eq(requisiteProviders.id, id),
            isNull(requisiteProviders.archivedAt),
          ),
        )
        .limit(1);

      return row ? toPublicProvider(row) : null;
    },
    async listProviders(input) {
      const conditions: SQL[] = [isNull(requisiteProviders.archivedAt)];

      if (input.name) {
        conditions.push(ilike(requisiteProviders.name, `%${input.name}%`));
      }

      if (input.kind?.length) {
        conditions.push(
          inArray(
            requisiteProviders.kind,
            input.kind as RequisiteProvider["kind"][],
          ),
        );
      }

      if (input.country?.length) {
        conditions.push(inArray(requisiteProviders.country, input.country));
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        PROVIDERS_SORT_COLUMN_MAP,
        requisiteProviders.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(requisiteProviders)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(requisiteProviders)
          .where(where),
      ]);

      return {
        data: rows.map(toPublicProvider),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<RequisiteProvider>;
    },
  };
}

export function createDrizzleRequisiteProvidersCommandRepository(
  db: Queryable,
): RequisiteProvidersCommandRepository {
  return {
    async insertProvider(input, tx) {
      const queryable = (tx as Queryable | undefined) ?? db;
      const [row] = await queryable
        .insert(requisiteProviders)
        .values({
          id: input.id,
          kind: input.kind,
          name: input.name,
          description: input.description ?? null,
          country: input.country ?? null,
          address: input.address ?? null,
          contact: input.contact ?? null,
          bic: input.bic ?? null,
          swift: input.swift ?? null,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to insert requisite provider");
      }

      return toPublicProvider(row);
    },
    async updateProvider(input, tx) {
      const queryable = (tx as Queryable | undefined) ?? db;
      const [row] = await queryable
        .update(requisiteProviders)
        .set({
          kind: input.kind,
          name: input.name,
          description: input.description,
          country: input.country,
          address: input.address,
          contact: input.contact,
          bic: input.bic,
          swift: input.swift,
        })
        .where(eq(requisiteProviders.id, input.id))
        .returning();

      return row ? toPublicProvider(row) : null;
    },
    async archiveProvider(id, archivedAt, tx) {
      const queryable = (tx as Queryable | undefined) ?? db;
      const [row] = await queryable
        .update(requisiteProviders)
        .set({
          archivedAt,
          updatedAt: archivedAt,
        })
        .where(eq(requisiteProviders.id, id))
        .returning({ id: requisiteProviders.id });

      return Boolean(row);
    },
  };
}
