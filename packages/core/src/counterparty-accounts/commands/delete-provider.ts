import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";

import {
  AccountProviderNotFoundError,
  AccountProviderInUseError,
} from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";

export function createDeleteProviderHandler(context: CounterpartyAccountsServiceContext) {
  const { db, log } = context;

  return async function deleteProvider(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [usage] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.counterpartyAccounts)
        .where(eq(schema.counterpartyAccounts.accountProviderId, id));

      if (usage && usage.count > 0) {
        throw new AccountProviderInUseError(id);
      }

      const [deleted] = await tx
        .delete(schema.counterpartyAccountProviders)
        .where(eq(schema.counterpartyAccountProviders.id, id))
        .returning({ id: schema.counterpartyAccountProviders.id });

      if (!deleted) {
        throw new AccountProviderNotFoundError(id);
      }

      log.info("Account provider deleted", { id });
    });
  };
}
