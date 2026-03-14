import { and, eq, sql, type SQL } from "drizzle-orm";

import {
  paginateInMemory,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  AccountingReportsContext,
  LiquidityRow,
} from "./types";
import {
  normalizeCurrency,
  toBigInt,
} from "../../../../domain/reports/normalization";
import { schema } from "../../../../infra/reporting/query-support/shared";
import {
  LiquidityQuerySchema,
  type LiquidityQuery,
} from "../reports-validation";

export function createListLiquidityHandler(context: AccountingReportsContext) {
  return async function listLiquidity(
    input?: LiquidityQuery,
  ): Promise<PaginatedList<LiquidityRow> & {
    scopeMeta: ReturnType<AccountingReportsContext["buildScopeMeta"]>;
  }> {
    const query = LiquidityQuerySchema.parse(input ?? {});
    const limit = query.limit;
    const offset = query.offset;

    const scope = await context.resolveScope({
      scopeType: query.scopeType,
      counterpartyIds: query.counterpartyId,
      groupIds: query.groupId,
      bookIds: query.bookId,
      includeDescendants: query.includeDescendants,
    });

    if (
      (scope.scopeType === "counterparty" || scope.scopeType === "group") &&
      scope.resolvedCounterpartyIds.length === 0
    ) {
      return {
        data: [],
        total: 0,
        limit,
        offset,
        scopeMeta: context.buildScopeMeta({
          scope,
          attributionMode: query.attributionMode,
          hasUnattributedData: false,
        }),
      };
    }

    const conditions: SQL[] = [
      eq(schema.balancePositions.subjectType, "organization_requisite"),
    ];

    if (scope.scopeType === "book") {
      conditions.push(
        sql`${schema.balancePositions.bookId} IN (${sql.join(
          scope.resolvedBookIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (scope.scopeType === "counterparty" || scope.scopeType === "group") {
      if (query.attributionMode === "book_org") {
        const internalOrganizationIdSet = new Set(
          await context.listInternalLedgerOrganizationIds(),
        );
        const bookScopedCounterpartyIds = scope.resolvedCounterpartyIds.filter((id) =>
          internalOrganizationIdSet.has(id),
        );
        if (bookScopedCounterpartyIds.length === 0) {
          return {
            data: [],
            total: 0,
            limit,
            offset,
            scopeMeta: context.buildScopeMeta({
              scope,
              attributionMode: query.attributionMode,
              hasUnattributedData: false,
            }),
          };
        }
        conditions.push(
          sql`${schema.books.ownerId} IN (${sql.join(
            bookScopedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      } else {
        conditions.push(
          sql`${
            schema.requisites.organizationId
          } IN (${sql.join(
            scope.resolvedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )}) AND ${schema.requisites.ownerType} = 'organization'`,
        );
      }
    }

    if (scope.scopeType === "all" && query.attributionMode === "book_org") {
      const internalOrganizationIds = await context.listInternalLedgerOrganizationIds();
      if (internalOrganizationIds.length === 0) {
        return {
          data: [],
          total: 0,
          limit,
          offset,
          scopeMeta: context.buildScopeMeta({
            scope,
            attributionMode: query.attributionMode,
            hasUnattributedData: false,
          }),
        };
      }
      conditions.push(
        sql`${schema.books.ownerId} IN (${sql.join(
          internalOrganizationIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (query.currency) {
      conditions.push(eq(schema.balancePositions.currency, normalizeCurrency(query.currency)!));
    }

    const whereSql = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await context.db
      .select({
        bookId: schema.balancePositions.bookId,
        bookLabel: schema.books.name,
        counterpartyId: schema.requisites.organizationId,
        counterpartyName: schema.organizations.shortName,
        currency: schema.balancePositions.currency,
        ledgerBalanceMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.ledgerBalance}), 0)::text`,
        availableMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.available}), 0)::text`,
        reservedMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.reserved}), 0)::text`,
        pendingMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.pending}), 0)::text`,
      })
      .from(schema.balancePositions)
      .leftJoin(
        schema.requisites,
        and(
          eq(schema.requisites.id, schema.balancePositions.subjectId),
          eq(schema.requisites.ownerType, "organization"),
        ),
      )
      .leftJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.requisites.organizationId),
      )
      .leftJoin(schema.books, eq(schema.books.id, schema.balancePositions.bookId))
      .where(whereSql)
      .groupBy(
        schema.balancePositions.bookId,
        schema.books.name,
        schema.requisites.organizationId,
        schema.organizations.shortName,
        schema.balancePositions.currency,
      );

    const mapped: LiquidityRow[] = rows.map((row) => ({
      bookId: row.bookId,
      bookLabel: row.bookLabel ?? row.bookId,
      counterpartyId: row.counterpartyId,
      counterpartyName: row.counterpartyName,
      currency: row.currency,
      ledgerBalanceMinor: toBigInt(row.ledgerBalanceMinor),
      availableMinor: toBigInt(row.availableMinor),
      reservedMinor: toBigInt(row.reservedMinor),
      pendingMinor: toBigInt(row.pendingMinor),
    }));

    const sorted = sortInMemory(mapped, {
      sortMap: {
        book: (row: LiquidityRow) => row.bookLabel,
      },
      sortBy: "book",
      sortOrder: "asc",
    });

    const paginated = paginateInMemory(sorted, {
      limit,
      offset,
    });

    return {
      ...paginated,
      scopeMeta: context.buildScopeMeta({
        scope,
        attributionMode: query.attributionMode,
        hasUnattributedData: false,
      }),
    };
  };
}
