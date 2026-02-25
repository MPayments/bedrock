import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { AccountServiceContext } from "../internal/context";
import { ListAccountsQuerySchema, type ListAccountsQuery } from "../validation";

const SORT_COLUMN_MAP = {
  label: schema.accounts.label,
  createdAt: schema.accounts.createdAt,
} as const;

type AccountRow = typeof schema.accounts.$inferSelect & {
  postingAccountNo: string;
};

export function createListAccountsHandler(context: AccountServiceContext) {
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
      conditions.push(ilike(schema.accounts.label, `%${label}%`));
    }

    if (counterpartyId) {
      conditions.push(eq(schema.accounts.counterpartyId, counterpartyId));
    }

    if (currencyId?.length) {
      conditions.push(inArray(schema.accounts.currencyId, currencyId));
    }

    if (accountProviderId) {
      conditions.push(eq(schema.accounts.accountProviderId, accountProviderId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.accounts.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: schema.accounts.id,
          counterpartyId: schema.accounts.counterpartyId,
          currencyId: schema.accounts.currencyId,
          accountProviderId: schema.accounts.accountProviderId,
          label: schema.accounts.label,
          description: schema.accounts.description,
          accountNo: schema.accounts.accountNo,
          corrAccount: schema.accounts.corrAccount,
          address: schema.accounts.address,
          iban: schema.accounts.iban,
          stableKey: schema.accounts.stableKey,
          postingAccountNo: schema.bookAccounts.accountNo,
          createdAt: schema.accounts.createdAt,
          updatedAt: schema.accounts.updatedAt,
        })
        .from(schema.accounts)
        .leftJoin(
          schema.operationalAccountBindings,
          eq(schema.operationalAccountBindings.accountId, schema.accounts.id),
        )
        .leftJoin(
          schema.bookAccounts,
          eq(
            schema.bookAccounts.id,
            schema.operationalAccountBindings.bookAccountId,
          ),
        )
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.accounts)
        .where(where),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        postingAccountNo: row.postingAccountNo ?? ACCOUNT_NO.BANK,
      })),
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
