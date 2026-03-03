import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";
import { schema } from "@bedrock/core/counterparty-accounts/schema";
import type { CounterpartyAccount } from "@bedrock/core/counterparty-accounts/schema";

import { AccountBindingNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";
import { ListAccountsQuerySchema, type ListAccountsQuery } from "../validation";

const SORT_COLUMN_MAP = {
  label: schema.counterpartyAccounts.label,
  createdAt: schema.counterpartyAccounts.createdAt,
} as const;

type AccountRow = CounterpartyAccount & {
  bookId: string;
  postingAccountNo: string;
};

export function createListCounterpartyAccountsHandler(
  context: CounterpartyAccountsServiceContext,
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
      conditions.push(ilike(schema.counterpartyAccounts.label, `%${label}%`));
    }

    if (counterpartyId) {
      conditions.push(
        eq(schema.counterpartyAccounts.counterpartyId, counterpartyId),
      );
    }

    if (currencyId?.length) {
      conditions.push(
        inArray(schema.counterpartyAccounts.currencyId, currencyId),
      );
    }

    if (accountProviderId) {
      conditions.push(
        eq(schema.counterpartyAccounts.accountProviderId, accountProviderId),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.counterpartyAccounts.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: schema.counterpartyAccounts.id,
          counterpartyId: schema.counterpartyAccounts.counterpartyId,
          bookId: schema.counterpartyAccountBindings.bookId,
          currencyId: schema.counterpartyAccounts.currencyId,
          accountProviderId: schema.counterpartyAccounts.accountProviderId,
          label: schema.counterpartyAccounts.label,
          description: schema.counterpartyAccounts.description,
          accountNo: schema.counterpartyAccounts.accountNo,
          corrAccount: schema.counterpartyAccounts.corrAccount,
          address: schema.counterpartyAccounts.address,
          iban: schema.counterpartyAccounts.iban,
          stableKey: schema.counterpartyAccounts.stableKey,
          postingAccountNo: schema.bookAccountInstances.accountNo,
          createdAt: schema.counterpartyAccounts.createdAt,
          updatedAt: schema.counterpartyAccounts.updatedAt,
        })
        .from(schema.counterpartyAccounts)
        .leftJoin(
          schema.counterpartyAccountBindings,
          eq(
            schema.counterpartyAccountBindings.counterpartyAccountId,
            schema.counterpartyAccounts.id,
          ),
        )
        .leftJoin(
          schema.bookAccountInstances,
          eq(
            schema.bookAccountInstances.id,
            schema.counterpartyAccountBindings.bookAccountInstanceId,
          ),
        )
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.counterpartyAccounts)
        .where(where),
    ]);

    const data = rows.map((row) => {
      if (!row.bookId || !row.postingAccountNo) {
        throw new AccountBindingNotFoundError(row.id);
      }

      return {
        ...row,
        bookId: row.bookId,
        postingAccountNo: row.postingAccountNo,
      };
    });

    return { data, total: countRows[0]?.total ?? 0, limit, offset };
  };
}
