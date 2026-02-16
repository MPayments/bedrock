import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createFeesService } from "../../src/service";
import { schema } from "@bedrock/db/schema";
import { db } from "./setup";

function uniq(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createFxQuote() {
    const rows = await db
        .insert(schema.fxQuotes)
        .values({
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 100000n,
            toAmountMinor: 85000n,
            pricingMode: "auto_cross",
            pricingTrace: { version: "v1", mode: "auto_cross" },
            dealDirection: null,
            dealForm: null,
            rateNum: 85n,
            rateDen: 100n,
            status: "active",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            idempotencyKey: uniq("quote"),
        })
        .returning({ id: schema.fxQuotes.id });

    return rows[0]!.id;
}

describe("Fees Service Integration Tests", () => {
    it("upserts rules and resolves only applicable rules in priority order", async () => {
        const service = createFeesService({ db });
        const at = new Date("2026-02-14T00:00:00.000Z");

        const specificRuleId = await service.upsertRule({
            name: uniq("specific"),
            operationKind: "fx_quote",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 25,
            fromCurrency: "usd",
            toCurrency: "eur",
            dealDirection: "cash_to_wire",
            dealForm: "conversion",
            priority: 10,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        const wildcardRuleId = await service.upsertRule({
            name: uniq("wildcard"),
            operationKind: "fx_quote",
            feeKind: "manual_fee",
            calcMethod: "fixed",
            fixedAmountMinor: 15n,
            fixedCurrency: "usd",
            priority: 100,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        await service.upsertRule({
            name: uniq("inactive"),
            operationKind: "fx_quote",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 99,
            isActive: false,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        await service.upsertRule({
            name: uniq("wrong-op"),
            operationKind: "funding",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 99,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        await service.upsertRule({
            name: uniq("expired"),
            operationKind: "fx_quote",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 99,
            effectiveFrom: new Date("2026-02-12T00:00:00.000Z"),
            effectiveTo: new Date("2026-02-13T00:00:00.000Z"),
        });

        await service.upsertRule({
            name: uniq("future"),
            operationKind: "fx_quote",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 99,
            effectiveFrom: new Date("2026-02-15T00:00:00.000Z"),
        });

        const applicable = (await service.listApplicableRules({
            operationKind: "fx_quote",
            at,
            fromCurrency: "usd",
            toCurrency: "eur",
            dealDirection: "cash_to_wire",
            dealForm: "conversion",
        })) as Array<{ id: string }>;

        expect(applicable.map((r) => r.id)).toEqual([specificRuleId, wildcardRuleId]);
    });

    it("calculates FX quote fee components from persisted rules", async () => {
        const service = createFeesService({ db });
        const at = new Date("2026-02-14T00:00:00.000Z");

        await service.upsertRule({
            name: uniq("bps-fee"),
            operationKind: "fx_quote",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 75,
            fromCurrency: "USD",
            toCurrency: "EUR",
            dealDirection: "cash_to_wire",
            dealForm: "conversion",
            priority: 10,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        await service.upsertRule({
            name: uniq("fixed-external"),
            operationKind: "fx_quote",
            feeKind: "bank_fee",
            calcMethod: "fixed",
            fixedAmountMinor: 200n,
            fixedCurrency: "eur",
            settlementMode: "separate_payment_order",
            debitAccountKey: "Account:branch:fees:EUR",
            creditAccountKey: "Account:treasury:revenue:EUR",
            transferCode: 777,
            memo: "External fee",
            metadata: { channel: "swift" },
            priority: 20,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        await service.upsertRule({
            name: uniq("zero-fixed"),
            operationKind: "fx_quote",
            feeKind: "manual_fee",
            calcMethod: "fixed",
            fixedAmountMinor: 0n,
            fixedCurrency: "USD",
            priority: 30,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        const components = await service.calculateFxQuoteFeeComponents({
            fromCurrency: "usd",
            toCurrency: "eur",
            principalMinor: 12345n,
            at,
            dealDirection: "cash_to_wire",
            dealForm: "conversion",
        });

        expect(components).toHaveLength(2);

        expect(components[0]).toMatchObject({
            kind: "fx_fee",
            currency: "USD",
            amountMinor: 92n,
            source: "rule",
        });

        expect(components[1]).toMatchObject({
            kind: "bank_fee",
            currency: "EUR",
            amountMinor: 200n,
            settlementMode: "separate_payment_order",
            debitAccountKey: "Account:branch:fees:EUR",
            creditAccountKey: "Account:treasury:revenue:EUR",
            transferCode: 777,
            memo: "External fee",
            metadata: { channel: "swift" },
        });
    });

    it("saves and replaces quote fee component snapshots", async () => {
        const service = createFeesService({ db });
        const ruleId = await service.upsertRule({
            name: uniq("snapshot-rule"),
            operationKind: "fx_quote",
            feeKind: "fx_fee",
            calcMethod: "bps",
            bps: 20,
            effectiveFrom: new Date("2026-02-13T00:00:00.000Z"),
        });

        const quoteId = await createFxQuote();

        await service.saveQuoteFeeComponents({
            quoteId,
            components: [
                {
                    id: "fee-1",
                    ruleId,
                    kind: "fx_fee",
                    currency: "usd",
                    amountMinor: 10n,
                    source: "rule",
                },
                {
                    id: "fee-2",
                    kind: "manual_fee",
                    currency: "usd",
                    amountMinor: 3n,
                    source: "manual",
                    settlementMode: "separate_payment_order",
                    debitAccountKey: `Account:fees:debit:${randomUUID()}`,
                    creditAccountKey: `Account:fees:credit:${randomUUID()}`,
                    transferCode: 888,
                    memo: "Manual adjustment",
                    metadata: { source: "operator" },
                },
            ],
        });

        const firstRead = await service.getQuoteFeeComponents({ quoteId });
        expect(firstRead).toHaveLength(2);
        expect(firstRead[0]).toMatchObject({
            id: `quote_component:${quoteId}:1`,
            ruleId,
            currency: "USD",
            settlementMode: "in_ledger",
        });
        expect(firstRead[1]).toMatchObject({
            id: `quote_component:${quoteId}:2`,
            kind: "manual_fee",
            settlementMode: "separate_payment_order",
            transferCode: 888,
            memo: "Manual adjustment",
            metadata: { source: "operator" },
        });

        await service.saveQuoteFeeComponents({
            quoteId,
            components: [
                {
                    id: "fee-replacement",
                    kind: "fx_spread",
                    currency: "USD",
                    amountMinor: 99n,
                    source: "rule",
                },
            ],
        });

        const secondRead = await service.getQuoteFeeComponents({ quoteId });
        expect(secondRead).toHaveLength(1);
        expect(secondRead[0]).toMatchObject({
            id: `quote_component:${quoteId}:1`,
            kind: "fx_spread",
            amountMinor: 99n,
        });
    });
});
