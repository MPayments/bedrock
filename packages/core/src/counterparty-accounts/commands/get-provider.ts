import { eq } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";

export function createGetProviderHandler(context: CounterpartyAccountsServiceContext) {
  const { db } = context;

  return async function getProvider(id: string) {
    const [row] = await db
      .select()
      .from(schema.counterpartyAccountProviders)
      .where(eq(schema.counterpartyAccountProviders.id, id))
      .limit(1);

    if (!row) {
      throw new AccountProviderNotFoundError(id);
    }

    return row;
  };
}
