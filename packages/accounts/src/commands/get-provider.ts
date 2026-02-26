import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";

export function createGetProviderHandler(context: AccountServiceContext) {
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
