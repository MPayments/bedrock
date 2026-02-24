import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";

export function createGetAccountHandler(context: AccountServiceContext) {
    const { db } = context;

    return async function getAccount(id: string) {
        const [row] = await db
            .select()
            .from(schema.accounts)
            .where(eq(schema.accounts.id, id))
            .limit(1);

        if (!row) {
            throw new AccountNotFoundError(id);
        }

        return row;
    };
}
