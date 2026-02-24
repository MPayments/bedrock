import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import {
    AccountProviderNotFoundError,
    AccountProviderInUseError,
} from "../errors";
import type { AccountServiceContext } from "../internal/context";

export function createDeleteProviderHandler(context: AccountServiceContext) {
    const { db, log } = context;

    return async function deleteProvider(id: string): Promise<void> {
        await db.transaction(async (tx) => {
            const [usage] = await tx
                .select({ count: sql<number>`count(*)::int` })
                .from(schema.accounts)
                .where(eq(schema.accounts.accountProviderId, id));

            if (usage && usage.count > 0) {
                throw new AccountProviderInUseError(id);
            }

            const [deleted] = await tx
                .delete(schema.accountProviders)
                .where(eq(schema.accountProviders.id, id))
                .returning({ id: schema.accountProviders.id });

            if (!deleted) {
                throw new AccountProviderNotFoundError(id);
            }

            log.info("Account provider deleted", { id });
        });
    };
}
