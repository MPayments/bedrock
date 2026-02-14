import { describe, it, expect } from "vitest";
import { createLedgerEngine } from "@bedrock/ledger";
import { createFeesService } from "@bedrock/fees";
import { createTreasuryService } from "../../src/service";
import { InvalidStateError, NotFoundError, CurrencyMismatchError, AmountMismatchError } from "../../src/errors";
import {
    db,
    createTestScenario,
    createTestFxQuote,
    getPaymentOrder,
    getJournalEntry,
    getJournalLines,
    getTbTransferPlans,
    getOutboxEntry,
    updateOrderStatus,
    randomRailRef,
    randomQuoteRef
} from "./helpers";

describe("Treasury Service Integration Tests", () => {
    const ledger = createLedgerEngine({ db });
    const feesService = createFeesService({ db });

    describe("fundingSettled", () => {
        it("should process funding and create ledger entry", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const railRef = randomRailRef();
            const entryId = await service.fundingSettled({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                branchBankStableKey: scenario.branchBankAccount.stableKey,
                customerId: scenario.customer.id,
                currency: "USD",
                amountMinor: 100000n,
                railRef,
                occurredAt: new Date()
            });

            // Verify order state updated
            const order = await getPaymentOrder(scenario.order.id);
            expect(order).toBeDefined();
            expect(order!.status).toBe("funding_settled_pending_posting");
            expect(order!.ledgerEntryId).toBe(entryId);

            // Verify journal entry created
            const entry = await getJournalEntry(entryId);
            expect(entry).toBeDefined();
            expect(entry!.status).toBe("pending");
            expect(entry!.idempotencyKey).toBe(`funding:${railRef}`);

            // Verify journal lines (debit bank, credit customer wallet)
            const lines = await getJournalLines(entryId);
            expect(lines).toHaveLength(2);

            const debitLine = lines.find(l => l.side === "debit");
            const creditLine = lines.find(l => l.side === "credit");
            expect(debitLine).toBeDefined();
            expect(creditLine).toBeDefined();
            expect(debitLine!.amountMinor).toBe(100000n);
            expect(creditLine!.amountMinor).toBe(100000n);

            // Verify outbox entry created
            const outbox = await getOutboxEntry(entryId);
            expect(outbox).toBeDefined();
            expect(outbox!.kind).toBe("post_journal");
            expect(outbox!.status).toBe("pending");
        });

        it("should be idempotent with same rail reference", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const railRef = randomRailRef();
            const input = {
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                branchBankStableKey: scenario.branchBankAccount.stableKey,
                customerId: scenario.customer.id,
                currency: "USD",
                amountMinor: 100000n,
                railRef,
                occurredAt: new Date()
            };

            // First call
            const entryId1 = await service.fundingSettled(input);

            // Simulate order being posted (advanced state)
            await updateOrderStatus(scenario.order.id, "funding_settled");

            // Second call with same rail ref should be idempotent
            const entryId2 = await service.fundingSettled(input);

            expect(entryId1).toBe(entryId2);

            // Should only have one set of journal lines
            const lines = await getJournalLines(entryId1);
            expect(lines).toHaveLength(2);
        });

        it("should throw NotFoundError for non-existent order", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.fundingSettled({
                    orderId: "00000000-0000-0000-0000-000000000000",
                    branchOrgId: scenario.branchOrg.id,
                    branchBankStableKey: scenario.branchBankAccount.stableKey,
                    customerId: scenario.customer.id,
                    currency: "USD",
                    amountMinor: 100000n,
                    railRef: randomRailRef(),
                    occurredAt: new Date()
                })
            ).rejects.toThrow(NotFoundError);
        });

        it("should throw CurrencyMismatchError for wrong currency", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.fundingSettled({
                    orderId: scenario.order.id,
                    branchOrgId: scenario.branchOrg.id,
                    branchBankStableKey: scenario.branchBankAccount.stableKey,
                    customerId: scenario.customer.id,
                    currency: "GBP", // Wrong currency
                    amountMinor: 100000n,
                    railRef: randomRailRef(),
                    occurredAt: new Date()
                })
            ).rejects.toThrow(CurrencyMismatchError);
        });

        it("should throw AmountMismatchError for wrong amount", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.fundingSettled({
                    orderId: scenario.order.id,
                    branchOrgId: scenario.branchOrg.id,
                    branchBankStableKey: scenario.branchBankAccount.stableKey,
                    customerId: scenario.customer.id,
                    currency: "USD",
                    amountMinor: 50000n, // Wrong amount
                    railRef: randomRailRef(),
                    occurredAt: new Date()
                })
            ).rejects.toThrow(AmountMismatchError);
        });
    });

    describe("executeFx", () => {
        async function createQuoteForOrder(
            scenario: Awaited<ReturnType<typeof createTestScenario>>,
            quoteRef: string,
            overrides: Partial<{
                status: "active" | "used" | "expired" | "cancelled";
                usedByRef: string | null;
                expiresAt: Date;
            }> = {}
        ) {
            await createTestFxQuote(
                {
                    fromCurrency: scenario.order.payInCurrency,
                    toCurrency: scenario.order.payOutCurrency,
                    fromAmountMinor: scenario.order.payInExpectedMinor,
                    toAmountMinor: scenario.order.payOutAmountMinor,
                    idempotencyKey: quoteRef,
                },
                {
                    status: overrides.status,
                    usedByRef: overrides.usedByRef,
                    expiresAt: overrides.expiresAt,
                }
            );
        }

        it("should execute FX and create multiple transfers", async () => {
            const scenario = await createTestScenario({ orderStatus: "funding_settled" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const quoteRef = randomQuoteRef();
            await createQuoteForOrder(scenario, quoteRef);
            const entryId = await service.executeFx({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                customerId: scenario.customer.id,
                payInCurrency: "USD",
                principalMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                occurredAt: new Date(),
                quoteRef
            });

            // Verify order state updated
            const order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("fx_executed_pending_posting");
            expect(order!.ledgerEntryId).toBe(entryId);

            // Verify journal entry created
            const entry = await getJournalEntry(entryId);
            expect(entry).toBeDefined();
            expect(entry!.idempotencyKey).toBe(`fx:${quoteRef}`);

            // Should have multiple transfers: principal, leg postings, payout obligation
            const plans = await getTbTransferPlans(entryId);
            expect(plans.length).toBeGreaterThanOrEqual(3); // At least principal + intercompany + obligation

            // All should be linked in a chain
            const linkedCount = plans.filter(p => p.isLinked).length;
            expect(linkedCount).toBe(plans.length - 1); // All but last should be linked
        });

        it("should skip fee transfer when quote/manual fees are absent", async () => {
            const scenario = await createTestScenario({ orderStatus: "funding_settled" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const quoteRef = randomQuoteRef();
            await createQuoteForOrder(scenario, quoteRef);
            const entryId = await service.executeFx({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                customerId: scenario.customer.id,
                payInCurrency: "USD",
                principalMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                occurredAt: new Date(),
                quoteRef
            });

            const plans = await getTbTransferPlans(entryId);
            // Without fee and spread, should have: principal, intercompany commit, payout obligation
            expect(plans).toHaveLength(3);
        });

        it("should reject expired quote", async () => {
            const scenario = await createTestScenario({ orderStatus: "funding_settled" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const quoteRef = randomQuoteRef();
            await createQuoteForOrder(scenario, quoteRef, {
                expiresAt: new Date(Date.now() - 5_000)
            });

            await expect(
                service.executeFx({
                    orderId: scenario.order.id,
                    branchOrgId: scenario.branchOrg.id,
                    customerId: scenario.customer.id,
                    payInCurrency: "USD",
                    principalMinor: 100000n,
                    payOutCurrency: "EUR",
                    payOutAmountMinor: 85000n,
                    occurredAt: new Date(),
                    quoteRef
                })
            ).rejects.toThrow(InvalidStateError);
        });

        it("should reject quote already used by another order", async () => {
            const scenario = await createTestScenario({ orderStatus: "funding_settled" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const quoteRef = randomQuoteRef();
            await createQuoteForOrder(scenario, quoteRef, {
                status: "used",
                usedByRef: "order:other-order:fx"
            });

            await expect(
                service.executeFx({
                    orderId: scenario.order.id,
                    branchOrgId: scenario.branchOrg.id,
                    customerId: scenario.customer.id,
                    payInCurrency: "USD",
                    principalMinor: 100000n,
                    payOutCurrency: "EUR",
                    payOutAmountMinor: 85000n,
                    occurredAt: new Date(),
                    quoteRef
                })
            ).rejects.toThrow(InvalidStateError);
        });

        it("should throw InvalidStateError if order is not funding_settled", async () => {
            const scenario = await createTestScenario({ orderStatus: "quote" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.executeFx({
                    orderId: scenario.order.id,
                    branchOrgId: scenario.branchOrg.id,
                    customerId: scenario.customer.id,
                    payInCurrency: "USD",
                    principalMinor: 100000n,
                    payOutCurrency: "EUR",
                    payOutAmountMinor: 85000n,
                    occurredAt: new Date(),
                    quoteRef: randomQuoteRef()
                })
            ).rejects.toThrow(InvalidStateError);
        });
    });

    describe("initiatePayout", () => {
        it("should create pending payout transfer", async () => {
            const scenario = await createTestScenario({ orderStatus: "fx_executed" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const railRef = randomRailRef();
            const result = await service.initiatePayout({
                orderId: scenario.order.id,
                payoutOrgId: scenario.payoutOrg.id,
                payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                payOutCurrency: "EUR",
                amountMinor: 85000n,
                railRef,
                occurredAt: new Date(),
                timeoutSeconds: 3600
            });

            expect(result.entryId).toBeDefined();
            expect(result.pendingTransferId).toBeDefined();
            expect(typeof result.pendingTransferId).toBe("bigint");

            // Verify order state
            const order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("payout_initiated_pending_posting");
            expect(order!.payoutPendingTransferId).toBe(result.pendingTransferId);

            // Verify pending transfer plan
            const plans = await getTbTransferPlans(result.entryId);
            expect(plans).toHaveLength(1);
            expect(plans[0]!.isPending).toBe(true);
            expect(plans[0]!.timeoutSeconds).toBe(3600);
        });

        it("should use default timeout when not specified", async () => {
            const scenario = await createTestScenario({ orderStatus: "fx_executed" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const result = await service.initiatePayout({
                orderId: scenario.order.id,
                payoutOrgId: scenario.payoutOrg.id,
                payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                payOutCurrency: "EUR",
                amountMinor: 85000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
                // No timeoutSeconds specified
            });

            const plans = await getTbTransferPlans(result.entryId);
            expect(plans[0]!.timeoutSeconds).toBe(86400); // Default 24 hours
        });

        it("should throw InvalidStateError if order is not fx_executed", async () => {
            const scenario = await createTestScenario({ orderStatus: "funding_settled" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.initiatePayout({
                    orderId: scenario.order.id,
                    payoutOrgId: scenario.payoutOrg.id,
                    payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                    payOutCurrency: "EUR",
                    amountMinor: 85000n,
                    railRef: randomRailRef(),
                    occurredAt: new Date()
                })
            ).rejects.toThrow(InvalidStateError);
        });
    });

    describe("settlePayout", () => {
        it("should post pending transfer", async () => {
            // Create scenario and manually set up payout_initiated state
            const scenario = await createTestScenario({ orderStatus: "fx_executed" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            // First initiate payout
            const initResult = await service.initiatePayout({
                orderId: scenario.order.id,
                payoutOrgId: scenario.payoutOrg.id,
                payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                payOutCurrency: "EUR",
                amountMinor: 85000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
            });

            // Simulate posting worker advancing state
            await updateOrderStatus(scenario.order.id, "payout_initiated");

            // Now settle the payout
            const settleRailRef = randomRailRef();
            const entryId = await service.settlePayout({
                orderId: scenario.order.id,
                payOutCurrency: "EUR",
                railRef: settleRailRef,
                occurredAt: new Date()
            });

            // Verify order state
            const order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("closed_pending_posting");

            // Verify post_pending transfer plan created
            const plans = await getTbTransferPlans(entryId);
            expect(plans).toHaveLength(1);
            expect(plans[0]!.type).toBe("post_pending");
            expect(plans[0]!.pendingId).toBe(initResult.pendingTransferId);
        });

        it("should throw InvalidStateError if order is not payout_initiated", async () => {
            const scenario = await createTestScenario({ orderStatus: "fx_executed" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.settlePayout({
                    orderId: scenario.order.id,
                    payOutCurrency: "EUR",
                    railRef: randomRailRef(),
                    occurredAt: new Date()
                })
            ).rejects.toThrow(InvalidStateError);
        });
    });

    describe("voidPayout", () => {
        it("should void pending transfer", async () => {
            const scenario = await createTestScenario({ orderStatus: "fx_executed" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            // First initiate payout
            const initResult = await service.initiatePayout({
                orderId: scenario.order.id,
                payoutOrgId: scenario.payoutOrg.id,
                payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                payOutCurrency: "EUR",
                amountMinor: 85000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
            });

            // Simulate posting worker advancing state
            await updateOrderStatus(scenario.order.id, "payout_initiated");

            // Void the payout
            const voidRailRef = randomRailRef();
            const entryId = await service.voidPayout({
                orderId: scenario.order.id,
                payOutCurrency: "EUR",
                railRef: voidRailRef,
                occurredAt: new Date()
            });

            // Verify order state
            const order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("failed_pending_posting");

            // Verify void_pending transfer plan created
            const plans = await getTbTransferPlans(entryId);
            expect(plans).toHaveLength(1);
            expect(plans[0]!.type).toBe("void_pending");
            expect(plans[0]!.pendingId).toBe(initResult.pendingTransferId);
            expect(plans[0]!.amount).toBe(0n);
        });

        it("should throw InvalidStateError if order is not payout_initiated", async () => {
            const scenario = await createTestScenario({ orderStatus: "fx_executed" });
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            await expect(
                service.voidPayout({
                    orderId: scenario.order.id,
                    payOutCurrency: "EUR",
                    railRef: randomRailRef(),
                    occurredAt: new Date()
                })
            ).rejects.toThrow(InvalidStateError);
        });
    });

    describe("full payment lifecycle", () => {
        it("should complete full payment flow: funding -> fx -> payout -> settle", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            // 1. Funding settled
            const fundingEntryId = await service.fundingSettled({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                branchBankStableKey: scenario.branchBankAccount.stableKey,
                customerId: scenario.customer.id,
                currency: "USD",
                amountMinor: 100000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
            });

            let order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("funding_settled_pending_posting");

            // Simulate posting worker
            await updateOrderStatus(scenario.order.id, "funding_settled");

            // 2. Execute FX
            const quoteRef = randomQuoteRef();
            await createTestFxQuote(
                {
                    fromCurrency: scenario.order.payInCurrency,
                    toCurrency: scenario.order.payOutCurrency,
                    fromAmountMinor: scenario.order.payInExpectedMinor,
                    toAmountMinor: scenario.order.payOutAmountMinor,
                    idempotencyKey: quoteRef,
                }
            );
            const fxEntryId = await service.executeFx({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                customerId: scenario.customer.id,
                payInCurrency: "USD",
                principalMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                occurredAt: new Date(),
                quoteRef
            });

            order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("fx_executed_pending_posting");

            // Simulate posting worker
            await updateOrderStatus(scenario.order.id, "fx_executed");

            // 3. Initiate payout
            const payoutResult = await service.initiatePayout({
                orderId: scenario.order.id,
                payoutOrgId: scenario.payoutOrg.id,
                payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                payOutCurrency: "EUR",
                amountMinor: 85000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
            });

            order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("payout_initiated_pending_posting");
            expect(order!.payoutPendingTransferId).toBe(payoutResult.pendingTransferId);

            // Simulate posting worker
            await updateOrderStatus(scenario.order.id, "payout_initiated");

            // 4. Settle payout
            const settleEntryId = await service.settlePayout({
                orderId: scenario.order.id,
                payOutCurrency: "EUR",
                railRef: randomRailRef(),
                occurredAt: new Date()
            });

            order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("closed_pending_posting");

            // Verify we created 4 journal entries total
            const entry1 = await getJournalEntry(fundingEntryId);
            const entry2 = await getJournalEntry(fxEntryId);
            const entry3 = await getJournalEntry(payoutResult.entryId);
            const entry4 = await getJournalEntry(settleEntryId);

            expect(entry1).toBeDefined();
            expect(entry2).toBeDefined();
            expect(entry3).toBeDefined();
            expect(entry4).toBeDefined();
        });

        it("should complete payment flow with void: funding -> fx -> payout -> void", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            // 1-3: Same as above until payout initiated
            await service.fundingSettled({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                branchBankStableKey: scenario.branchBankAccount.stableKey,
                customerId: scenario.customer.id,
                currency: "USD",
                amountMinor: 100000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
            });
            await updateOrderStatus(scenario.order.id, "funding_settled");

            const quoteRef = randomQuoteRef();
            await createTestFxQuote(
                {
                    fromCurrency: scenario.order.payInCurrency,
                    toCurrency: scenario.order.payOutCurrency,
                    fromAmountMinor: scenario.order.payInExpectedMinor,
                    toAmountMinor: scenario.order.payOutAmountMinor,
                    idempotencyKey: quoteRef,
                }
            );
            await service.executeFx({
                orderId: scenario.order.id,
                branchOrgId: scenario.branchOrg.id,
                customerId: scenario.customer.id,
                payInCurrency: "USD",
                principalMinor: 100000n,
                payOutCurrency: "EUR",
                payOutAmountMinor: 85000n,
                occurredAt: new Date(),
                quoteRef
            });
            await updateOrderStatus(scenario.order.id, "fx_executed");

            await service.initiatePayout({
                orderId: scenario.order.id,
                payoutOrgId: scenario.payoutOrg.id,
                payoutBankStableKey: scenario.payoutBankAccount.stableKey,
                payOutCurrency: "EUR",
                amountMinor: 85000n,
                railRef: randomRailRef(),
                occurredAt: new Date()
            });
            await updateOrderStatus(scenario.order.id, "payout_initiated");

            // 4. Void payout (simulating failed payout)
            await service.voidPayout({
                orderId: scenario.order.id,
                payOutCurrency: "EUR",
                railRef: randomRailRef(),
                occurredAt: new Date()
            });

            const order = await getPaymentOrder(scenario.order.id);
            expect(order!.status).toBe("failed_pending_posting");
        });
    });

    describe("keyspace integration", () => {
        it("should generate consistent account keys", async () => {
            const scenario = await createTestScenario();
            const service = createTreasuryService({
                db,
                ledger,
                feesService
            });

            const K = service.keys;

            // Verify deterministic key generation
            const customerWallet1 = K.customerWallet(scenario.customer.id, "USD");
            const customerWallet2 = K.customerWallet(scenario.customer.id, "USD");
            expect(customerWallet1).toBe(customerWallet2);

            const bank1 = K.bank(scenario.branchOrg.id, "bank-key", "USD");
            const bank2 = K.bank(scenario.branchOrg.id, "bank-key", "USD");
            expect(bank1).toBe(bank2);

            // Different inputs should produce different keys
            const walletUSD = K.customerWallet(scenario.customer.id, "USD");
            const walletEUR = K.customerWallet(scenario.customer.id, "EUR");
            expect(walletUSD).not.toBe(walletEUR);
        });
    });
});
