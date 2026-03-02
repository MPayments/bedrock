import { eq, inArray } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";
import {
  ResolveCounterpartyAccountBindingsInputSchema,
  type ResolveCounterpartyAccountBindingsInput,
  type CounterpartyAccountBinding,
} from "../validation";

export function createResolveCounterpartyAccountBindingsHandler(
  context: CounterpartyAccountsServiceContext,
) {
  const { db, log } = context;

  return async function resolveTransferBindings(
    input: ResolveCounterpartyAccountBindingsInput,
  ): Promise<CounterpartyAccountBinding[]> {
    const validated = ResolveCounterpartyAccountBindingsInputSchema.parse(input);
    const uniqueAccountIds = [...new Set(validated.accountIds)];

    const rows = await db
      .select({
        accountId: schema.counterpartyAccounts.id,
        bookId: schema.counterpartyAccountBindings.bookId,
        counterpartyId: schema.counterpartyAccounts.counterpartyId,
        currencyId: schema.counterpartyAccounts.currencyId,
        currencyCode: schema.currencies.code,
        stableKey: schema.counterpartyAccounts.stableKey,
      })
      .from(schema.counterpartyAccounts)
      .innerJoin(
        schema.counterpartyAccountBindings,
        eq(
          schema.counterpartyAccountBindings.counterpartyAccountId,
          schema.counterpartyAccounts.id,
        ),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.counterpartyAccounts.currencyId, schema.currencies.id),
      )
      .where(inArray(schema.counterpartyAccounts.id, uniqueAccountIds));

    if (rows.length !== uniqueAccountIds.length) {
      const foundIds = new Set(rows.map((row) => row.accountId));
      const missingId =
        uniqueAccountIds.find((id) => !foundIds.has(id)) ??
        uniqueAccountIds[0]!;
      throw new AccountNotFoundError(missingId);
    }

    const byAccountId = new Map<string, CounterpartyAccountBinding>();

    for (const row of rows) {
      byAccountId.set(row.accountId, {
        accountId: row.accountId,
        bookId: row.bookId,
        counterpartyId: row.counterpartyId,
        currencyId: row.currencyId,
        currencyCode: row.currencyCode,
        stableKey: row.stableKey,
      });
    }

    const orderedBindings = validated.accountIds.map(
      (id) => byAccountId.get(id)!,
    );

    log.debug("Resolved counterparty account bindings", {
      requested: validated.accountIds.length,
      uniqueAccounts: uniqueAccountIds.length,
    });

    return orderedBindings;
  };
}
