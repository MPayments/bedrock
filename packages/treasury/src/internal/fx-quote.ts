import { and, eq, sql } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";
import { isUuidLike } from "@bedrock/kernel/utils";
import { type Transaction } from "@bedrock/db";

import { AmountMismatchError, CurrencyMismatchError, InvalidStateError, NotFoundError, ValidationError } from "../errors";
import { type ExecuteFxValidatedInput } from "../validation";
import { type TreasuryServiceContext } from "./context";

function quoteUsageRef(orderId: string): string {
    return `order:${orderId}:fx`;
}

export async function consumeFxQuoteForExecution(
    tx: Transaction,
    input: ExecuteFxValidatedInput,
    currenciesService: TreasuryServiceContext["currenciesService"],
) {
    let quote: any | undefined;
    if (isUuidLike(input.quoteRef)) {
        const [byId] = await tx
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.id, input.quoteRef))
            .limit(1);
        const [byIdempotency] = await tx
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, input.quoteRef))
            .limit(1);

        if (byId && byIdempotency && byId.id !== byIdempotency.id) {
            throw new ValidationError(`quoteRef ${input.quoteRef} is ambiguous between quote ID and idempotency key`);
        }
        quote = byId ?? byIdempotency;
    } else {
        const [byIdempotency] = await tx
            .select()
            .from(schema.fxQuotes)
            .where(eq(schema.fxQuotes.idempotencyKey, input.quoteRef))
            .limit(1);
        quote = byIdempotency;
    }

    if (!quote) {
        throw new NotFoundError("FX quote", input.quoteRef);
    }

    const { code: quoteFromCurrency } = await currenciesService.findById(quote.fromCurrencyId);
    const { code: quoteToCurrency } = await currenciesService.findById(quote.toCurrencyId);
    const quoteWithCurrencies = {
        ...quote,
        fromCurrency: quoteFromCurrency,
        toCurrency: quoteToCurrency,
    };

    if (quoteFromCurrency !== input.payInCurrency) {
        throw new CurrencyMismatchError("quote.fromCurrency", quoteFromCurrency, input.payInCurrency);
    }
    if (quoteToCurrency !== input.payOutCurrency) {
        throw new CurrencyMismatchError("quote.toCurrency", quoteToCurrency, input.payOutCurrency);
    }
    if (quote.fromAmountMinor !== input.principalMinor) {
        throw new AmountMismatchError("quote.fromAmountMinor", quote.fromAmountMinor, input.principalMinor);
    }
    if (quote.toAmountMinor !== input.payOutAmountMinor) {
        throw new AmountMismatchError("quote.toAmountMinor", quote.toAmountMinor, input.payOutAmountMinor);
    }
    const usageRef = quoteUsageRef(input.orderId);

    if (quote.status === "used") {
        if (quote.usedByRef === usageRef) {
            return quoteWithCurrencies;
        }
        throw new InvalidStateError(`Quote ${quote.id} is already used by ${quote.usedByRef ?? "unknown reference"}`);
    }

    if (quote.status !== "active") {
        throw new InvalidStateError(`Quote ${quote.id} is not active (status=${quote.status})`);
    }

    const consumedAt = new Date();
    if (quote.expiresAt.getTime() < consumedAt.getTime()) {
        throw new InvalidStateError(`Quote ${quote.id} expired at ${quote.expiresAt.toISOString()}`);
    }

    const updated = await tx
        .update(schema.fxQuotes)
        .set({
            status: "used",
            usedByRef: usageRef,
            usedAt: consumedAt,
        })
        .where(
            and(
                eq(schema.fxQuotes.id, quote.id),
                eq(schema.fxQuotes.status, "active"),
                sql`${schema.fxQuotes.expiresAt} >= ${consumedAt}`
            )
        )
        .returning({ id: schema.fxQuotes.id, status: schema.fxQuotes.status, usedByRef: schema.fxQuotes.usedByRef });

    if (updated.length) {
        return quoteWithCurrencies;
    }

    const [latest] = await tx
        .select({ id: schema.fxQuotes.id, status: schema.fxQuotes.status, usedByRef: schema.fxQuotes.usedByRef })
        .from(schema.fxQuotes)
        .where(eq(schema.fxQuotes.id, quote.id))
        .limit(1);

    if (latest?.status === "used" && latest.usedByRef === usageRef) {
        return quoteWithCurrencies;
    }

    throw new InvalidStateError(
        `Quote ${quote.id} could not be consumed atomically (status=${latest?.status ?? "unknown"})`
    );
}
