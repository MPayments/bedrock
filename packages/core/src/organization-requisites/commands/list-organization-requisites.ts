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

import type { OrganizationRequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  ListOrganizationRequisitesQuerySchema,
  type ListOrganizationRequisitesQuery,
  type OrganizationRequisite,
} from "../validation";
import type { RequisiteKind } from "../../requisites/shared";

const SORT_COLUMN_MAP = {
  label: schema.organizationRequisites.label,
  kind: schema.organizationRequisites.kind,
  createdAt: schema.organizationRequisites.createdAt,
  updatedAt: schema.organizationRequisites.updatedAt,
} as const;

export function createListOrganizationRequisitesHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db } = context;

  return async function listOrganizationRequisites(
    input?: ListOrganizationRequisitesQuery,
  ): Promise<PaginatedList<OrganizationRequisite>> {
    const query = ListOrganizationRequisitesQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      label,
      organizationId,
      currencyId,
      kind,
    } = query;

    const conditions: SQL[] = [isNull(schema.organizationRequisites.archivedAt)];

    if (label) {
      conditions.push(ilike(schema.organizationRequisites.label, `%${label}%`));
    }

    if (organizationId) {
      conditions.push(
        eq(schema.organizationRequisites.organizationId, organizationId),
      );
    }

    if (currencyId?.length) {
      conditions.push(inArray(schema.organizationRequisites.currencyId, currencyId));
    }

    if (kind?.length) {
      conditions.push(
        inArray(schema.organizationRequisites.kind, kind as RequisiteKind[]),
      );
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.organizationRequisites.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.organizationRequisites)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.organizationRequisites)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
