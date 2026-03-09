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

import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { RequisitesServiceContext } from "../internal/context";
import { toPublicRequisite } from "../internal/shape";
import { schema } from "../schema";
import type { RequisiteKind } from "../shared";
import {
  ListRequisitesQuerySchema,
  type ListRequisitesQuery,
  type Requisite,
  type RequisiteOwnerType,
} from "../validation";

const SORT_COLUMN_MAP = {
  label: schema.requisites.label,
  kind: schema.requisites.kind,
  createdAt: schema.requisites.createdAt,
  updatedAt: schema.requisites.updatedAt,
} as const;

export function createListRequisitesHandler(context: RequisitesServiceContext) {
  const { db } = context;

  return async function listRequisites(
    input?: ListRequisitesQuery,
  ): Promise<PaginatedList<Requisite>> {
    const query = ListRequisitesQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      label,
      ownerType,
      ownerId,
      currencyId,
      kind,
      providerId,
    } = query;

    const conditions: SQL[] = [isNull(schema.requisites.archivedAt)];

    if (label) {
      conditions.push(ilike(schema.requisites.label, `%${label}%`));
    }

    if (ownerType?.length) {
      conditions.push(
        eq(schema.requisites.ownerType, ownerType as RequisiteOwnerType),
      );
    }

    if (ownerId && ownerType === "organization") {
      conditions.push(eq(schema.requisites.organizationId, ownerId));
    }
    if (ownerId && ownerType === "counterparty") {
      conditions.push(eq(schema.requisites.counterpartyId, ownerId));
    }

    if (currencyId?.length) {
      conditions.push(inArray(schema.requisites.currencyId, currencyId));
    }

    if (kind?.length) {
      conditions.push(inArray(schema.requisites.kind, kind as RequisiteKind[]));
    }

    if (providerId?.length) {
      conditions.push(inArray(schema.requisites.providerId, providerId));
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.requisites.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.requisites)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.requisites)
        .where(where),
    ]);

    return {
      data: rows.map(toPublicRequisite),
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
