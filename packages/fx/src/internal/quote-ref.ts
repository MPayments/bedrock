import { eq } from "drizzle-orm";
import { type FxQuote, schema } from "@bedrock/db/schema";
import { ValidationError } from "@bedrock/kernel/errors";
import { isUuidLike } from "@bedrock/kernel/utils";
import { type FxServiceContext } from "./context";

async function withCurrencyCodes(context: FxServiceContext, quote: FxQuote): Promise<FxQuote> {
    const [fromCurrency, toCurrency] = await Promise.all([
        context.currenciesService.findById(quote.fromCurrencyId),
        context.currenciesService.findById(quote.toCurrencyId),
    ]);

    return {
        ...quote,
        fromCurrency: fromCurrency.code,
        toCurrency: toCurrency.code,
    } as FxQuote;
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

        const resolved = byId ?? byIdempotency;
        return resolved ? withCurrencyCodes(context, resolved) : undefined;
    }

    const [byIdempotency] = await db
        .select()
        .from(schema.fxQuotes)
        .where(eq(schema.fxQuotes.idempotencyKey, quoteRef))
        .limit(1);
    return byIdempotency ? withCurrencyCodes(context, byIdempotency) : undefined;
}
