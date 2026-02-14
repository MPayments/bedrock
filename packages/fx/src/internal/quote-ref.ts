import { eq } from "drizzle-orm";
import { type FxQuote, schema } from "@bedrock/db/schema";
import { ValidationError } from "@bedrock/kernel/errors";

import { type FxServiceContext } from "./context";

function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function resolveQuoteByRef(context: FxServiceContext, quoteRef: string): Promise<FxQuote | undefined> {
    const { db } = context;

    if (isUuidLike(quoteRef)) {
        const [byId] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, quoteRef))
            .limit(1);
        const [byIdempotency] = await db
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
            .limit(1);

        if (byId && byIdempotency && byId.id !== byIdempotency.id) {
            throw new ValidationError(`quoteRef ${quoteRef} is ambiguous between quote ID and idempotency key`);
        }

        return byId ?? byIdempotency;
    }

    const [byIdempotency] = await db
        .select()
        .from(schema.fxQuotes)
        .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
        .limit(1);
    return byIdempotency;
}
