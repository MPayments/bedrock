import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";
import type { Account } from "@bedrock/db/schema";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { AccountServiceContext } from "../internal/context";
import { ListAccountsQuerySchema, type ListAccountsQuery } from "../validation";

const SORT_COLUMN_MAP = {
  label: schema.operationalAccounts.label,
  createdAt: schema.operationalAccounts.createdAt,
} as const;

type AccountRow = Account & {
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
          currencyId: schema.operationalAccounts.currencyId,
          accountProviderId: schema.operationalAccounts.accountProviderId,
          label: schema.operationalAccounts.label,
          description: schema.operationalAccounts.description,
          accountNo: schema.operationalAccounts.accountNo,
          corrAccount: schema.operationalAccounts.corrAccount,
          address: schema.operationalAccounts.address,
          iban: schema.operationalAccounts.iban,
          stableKey: schema.operationalAccounts.stableKey,
          postingAccountNo: schema.bookAccounts.accountNo,
          createdAt: schema.operationalAccounts.createdAt,
          updatedAt: schema.operationalAccounts.updatedAt,
        })
        .from(schema.operationalAccounts)
        .leftJoin(
          schema.operationalAccountsBookBindings,
          eq(
            schema.operationalAccountsBookBindings.operationalAccountId,
            schema.operationalAccounts.id,
          ),
        )
        .leftJoin(
          schema.bookAccounts,
          eq(
            schema.bookAccounts.id,
            schema.operationalAccountsBookBindings.bookAccountId,
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
        postingAccountNo: row.postingAccountNo ?? ACCOUNT_NO.BANK,
      })),
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
