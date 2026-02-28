import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { CounterpartyNotFoundError } from "../errors";
import type { CounterpartiesServiceContext } from "../internal/context";

export function createRemoveCounterpartyHandler(
    context: CounterpartiesServiceContext,
) {
    const { db, log } = context;

    return async function removeCounterparty(id: string): Promise<void> {
        const [deleted] = await db
            .delete(schema.counterparties)
            .where(eq(schema.counterparties.id, id))
            .returning({ id: schema.counterparties.id });

        if (!deleted) {
            throw new CounterpartyNotFoundError(id);
        }

        log.info("Counterparty deleted", { id });
    };
}
