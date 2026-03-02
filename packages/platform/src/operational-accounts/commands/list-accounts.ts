import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema/operational-accounts";
import type { OperationalAccount } from "@bedrock/db/schema/operational-accounts";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/foundation/kernel/pagination";
import { ACCOUNT_NO } from "@bedrock/platform/accounting";

import type { OperationalAccountsServiceContext } from "../internal/context";
import { ListAccountsQuerySchema, type ListAccountsQuery } from "../validation";

const SORT_COLUMN_MAP = {
  label: schema.operationalAccounts.label,
  createdAt: schema.operationalAccounts.createdAt,
} as const;

type AccountRow = OperationalAccount & {
  bookId: string;
  postingAccountNo: string;
};

export function createListOperationalAccountsHandler(
  context: OperationalAccountsServiceContext,
) {
  const { db } = context;

  return async function listAccounts(
    input?: ListAccountsQuery,
  ): Promise<PaginatedList<AccountRow>> {
    const query = ListAccountsQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      label,
      counterpartyId,
      currencyId,
      accountProviderId,
    } = query;

    const conditions: SQL[] = [];

    if (label) {
      conditions.push(ilike(schema.operationalAccounts.label, `%${label}%`));
    }

    if (counterpartyId) {
      conditions.push(
        eq(schema.operationalAccounts.counterpartyId, counterpartyId),
      );
    }

    if (currencyId?.length) {
      conditions.push(
        inArray(schema.operationalAccounts.currencyId, currencyId),
      );
    }

    if (accountProviderId) {
      conditions.push(
        eq(schema.operationalAccounts.accountProviderId, accountProviderId),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.operationalAccounts.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: schema.operationalAccounts.id,
          counterpartyId: schema.operationalAccounts.counterpartyId,
          bookId: schema.operationalAccountBindings.bookId,
          currencyId: schema.operationalAccounts.currencyId,
          accountProviderId: schema.operationalAccounts.accountProviderId,
          label: schema.operationalAccounts.label,
          description: schema.operationalAccounts.description,
          accountNo: schema.operationalAccounts.accountNo,
          corrAccount: schema.operationalAccounts.corrAccount,
          address: schema.operationalAccounts.address,
          iban: schema.operationalAccounts.iban,
          stableKey: schema.operationalAccounts.stableKey,
          postingAccountNo: schema.bookAccountInstances.accountNo,
          createdAt: schema.operationalAccounts.createdAt,
          updatedAt: schema.operationalAccounts.updatedAt,
        })
        .from(schema.operationalAccounts)
        .leftJoin(
          schema.operationalAccountBindings,
          eq(
            schema.operationalAccountBindings.operationalAccountId,
            schema.operationalAccounts.id,
          ),
        )
        .leftJoin(
          schema.bookAccountInstances,
          eq(
            schema.bookAccountInstances.id,
            schema.operationalAccountBindings.bookAccountInstanceId,
          ),
        )
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.operationalAccounts)
        .where(where),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        bookId: row.bookId ?? row.counterpartyId,
        postingAccountNo: row.postingAccountNo ?? ACCOUNT_NO.BANK,
      })),
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
