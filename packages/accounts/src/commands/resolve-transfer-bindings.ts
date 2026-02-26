import { eq, inArray } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";
import {
  ResolveTransferBindingsInputSchema,
  type ResolveTransferBindingsInput,
  type TransferAccountBinding,
} from "../validation";

export function createResolveTransferBindingsHandler(
  context: AccountServiceContext,
) {
  const { db, log } = context;

  return async function resolveTransferBindings(
    input: ResolveTransferBindingsInput,
  ): Promise<TransferAccountBinding[]> {
    const validated = ResolveTransferBindingsInputSchema.parse(input);
    const uniqueAccountIds = [...new Set(validated.accountIds)];

    const rows = await db
      .select({
        accountId: schema.operationalAccounts.id,
        counterpartyId: schema.operationalAccounts.counterpartyId,
        currencyId: schema.operationalAccounts.currencyId,
        currencyCode: schema.currencies.code,
        stableKey: schema.operationalAccounts.stableKey,
        bookAccountId: schema.bookAccounts.id,
        bookAccountNo: schema.bookAccounts.accountNo,
      })
      .from(schema.operationalAccounts)
      .innerJoin(
        schema.currencies,
        eq(schema.operationalAccounts.currencyId, schema.currencies.id),
      )
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
      .where(inArray(schema.operationalAccounts.id, uniqueAccountIds));

    if (rows.length !== uniqueAccountIds.length) {
      const foundIds = new Set(rows.map((row) => row.accountId));
      const missingId =
        uniqueAccountIds.find((id) => !foundIds.has(id)) ??
        uniqueAccountIds[0]!;
      throw new AccountNotFoundError(missingId);
    }

    const unresolved = rows.filter((row) => !row.bookAccountId);
    if (unresolved.length > 0) {
      const missingAccountId = unresolved[0]!.accountId;
      throw new Error(
        `Missing operational_account_binding for account=${missingAccountId}`,
      );
    }

    const byAccountId = new Map<string, TransferAccountBinding>();

    for (const row of rows) {
      if (!row.bookAccountId || !row.bookAccountNo) {
        throw new Error(
          `Missing book account binding for account=${row.accountId}`,
        );
      }

      byAccountId.set(row.accountId, {
        accountId: row.accountId,
        counterpartyId: row.counterpartyId,
        currencyId: row.currencyId,
        currencyCode: row.currencyCode,
        stableKey: row.stableKey,
        bookOrgId: row.counterpartyId,
        bookAccountId: row.bookAccountId,
        bookAccountNo: row.bookAccountNo,
      });
    }

    const orderedBindings = validated.accountIds.map(
      (id) => byAccountId.get(id)!,
    );

    log.debug("Resolved transfer account bindings", {
      requested: validated.accountIds.length,
      uniqueAccounts: uniqueAccountIds.length,
    });

    return orderedBindings;
  };
}
