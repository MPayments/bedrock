import { eq } from "drizzle-orm";

import { schema } from "@bedrock/platform/operational-accounts/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";

export function createGetProviderHandler(context: OperationalAccountsServiceContext) {
  const { db } = context;

  return async function getProvider(id: string) {
    const [row] = await db
      .select()
      .from(schema.operationalAccountProviders)
      .where(eq(schema.operationalAccountProviders.id, id))
      .limit(1);

    if (!row) {
      throw new AccountProviderNotFoundError(id);
    }

    return row;
  };
}
