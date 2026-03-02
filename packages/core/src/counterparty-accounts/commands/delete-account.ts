import { eq } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";

export function createDeleteCounterpartyAccountHandler(
  context: CounterpartyAccountsServiceContext,
) {
  const { db, log } = context;

  return async function deleteAccount(id: string): Promise<void> {
    const [deleted] = await db
      .delete(schema.counterpartyAccounts)
      .where(eq(schema.counterpartyAccounts.id, id))
      .returning({ id: schema.counterpartyAccounts.id });

    if (!deleted) {
      throw new AccountNotFoundError(id);
    }

    log.info("Account deleted", { id });
  };
}
