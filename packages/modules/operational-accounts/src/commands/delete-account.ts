import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError } from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";

export function createDeleteOperationalAccountHandler(
  context: OperationalAccountsServiceContext,
) {
  const { db, log } = context;

  return async function deleteAccount(id: string): Promise<void> {
    const [deleted] = await db
      .delete(schema.operationalAccounts)
      .where(eq(schema.operationalAccounts.id, id))
      .returning({ id: schema.operationalAccounts.id });

    if (!deleted) {
      throw new AccountNotFoundError(id);
    }

    log.info("Account deleted", { id });
  };
}
