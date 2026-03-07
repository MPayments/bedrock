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

import type { CounterpartyRequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  ListCounterpartyRequisitesQuerySchema,
  type CounterpartyRequisite,
  type ListCounterpartyRequisitesQuery,
} from "../validation";
import type { RequisiteKind } from "../../requisites/shared";

const SORT_COLUMN_MAP = {
  label: schema.counterpartyRequisites.label,
  kind: schema.counterpartyRequisites.kind,
  createdAt: schema.counterpartyRequisites.createdAt,
  updatedAt: schema.counterpartyRequisites.updatedAt,
} as const;

export function createListCounterpartyRequisitesHandler(
  context: CounterpartyRequisitesServiceContext,
) {
  const { db } = context;

  return async function listCounterpartyRequisites(
    input?: ListCounterpartyRequisitesQuery,
  ): Promise<PaginatedList<CounterpartyRequisite>> {
    const query = ListCounterpartyRequisitesQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      label,
      counterpartyId,
      currencyId,
      kind,
    } = query;

    const conditions: SQL[] = [isNull(schema.counterpartyRequisites.archivedAt)];

    if (label) {
      conditions.push(ilike(schema.counterpartyRequisites.label, `%${label}%`));
    }

    if (counterpartyId) {
      conditions.push(
        eq(schema.counterpartyRequisites.counterpartyId, counterpartyId),
      );
    }

    if (currencyId?.length) {
      conditions.push(inArray(schema.counterpartyRequisites.currencyId, currencyId));
    }

    if (kind?.length) {
      conditions.push(
        inArray(schema.counterpartyRequisites.kind, kind as RequisiteKind[]),
      );
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.counterpartyRequisites.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.counterpartyRequisites)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.counterpartyRequisites)
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
