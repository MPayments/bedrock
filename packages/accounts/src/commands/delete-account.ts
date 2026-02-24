import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";

export function createDeleteAccountHandler(context: AccountServiceContext) {
    const { db, log } = context;

    return async function deleteAccount(id: string): Promise<void> {
        const [deleted] = await db
            .delete(schema.accounts)
            .where(eq(schema.accounts.id, id))
            .returning({ id: schema.accounts.id });

        if (!deleted) {
            throw new AccountNotFoundError(id);
        }

        log.info("Account deleted", { id });
    };
}
