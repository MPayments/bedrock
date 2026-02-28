import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import {
  AccountProviderNotFoundError,
  AccountProviderInUseError,
} from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";

export function createDeleteProviderHandler(context: OperationalAccountsServiceContext) {
  const { db, log } = context;

  return async function deleteProvider(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [usage] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.operationalAccounts)
        .where(eq(schema.operationalAccounts.accountProviderId, id));

      if (usage && usage.count > 0) {
        throw new AccountProviderInUseError(id);
      }

      const [deleted] = await tx
        .delete(schema.operationalAccountProviders)
        .where(eq(schema.operationalAccountProviders.id, id))
        .returning({ id: schema.operationalAccountProviders.id });

      if (!deleted) {
        throw new AccountProviderNotFoundError(id);
      }

      log.info("Account provider deleted", { id });
    });
  };
}
