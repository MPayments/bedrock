import { eq, inArray } from "drizzle-orm";

import { schema } from "@bedrock/platform/operational-accounts/schema";

import { AccountNotFoundError } from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";
import {
  ResolveTransferBindingsInputSchema,
  type ResolveTransferBindingsInput,
  type TransferAccountBinding,
} from "../validation";

export function createResolveOperationalTransferBindingsHandler(
  context: OperationalAccountsServiceContext,
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
        bookId: schema.operationalAccountBindings.bookId,
        counterpartyId: schema.operationalAccounts.counterpartyId,
        currencyId: schema.operationalAccounts.currencyId,
        currencyCode: schema.currencies.code,
        stableKey: schema.operationalAccounts.stableKey,
      })
      .from(schema.operationalAccounts)
      .innerJoin(
        schema.operationalAccountBindings,
        eq(
          schema.operationalAccountBindings.operationalAccountId,
          schema.operationalAccounts.id,
        ),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.operationalAccounts.currencyId, schema.currencies.id),
      )
      .where(inArray(schema.operationalAccounts.id, uniqueAccountIds));

    if (rows.length !== uniqueAccountIds.length) {
      const foundIds = new Set(rows.map((row) => row.accountId));
      const missingId =
        uniqueAccountIds.find((id) => !foundIds.has(id)) ??
        uniqueAccountIds[0]!;
      throw new AccountNotFoundError(missingId);
    }

    const byAccountId = new Map<string, TransferAccountBinding>();

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

    log.debug("Resolved transfer account bindings", {
      requested: validated.accountIds.length,
      uniqueAccounts: uniqueAccountIds.length,
    });

    return orderedBindings;
  };
}
