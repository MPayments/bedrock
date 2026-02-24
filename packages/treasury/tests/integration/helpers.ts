import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { currencyIdForCode } from "@bedrock/db/seeds";
import { schema } from "@bedrock/db/schema";

import { db, tb } from "./setup";

// ============================================================================
// Random ID generators
// ============================================================================

export function randomCounterpartyId() {
    return randomUUID();
}

export function randomCustomerId() {
    return randomUUID();
}

export function randomOrderId() {
    return randomUUID();
}

export function randomIdempotencyKey() {
    return `idem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function randomRailRef() {
    return `rail-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function randomQuoteRef() {
    return `quote-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// ============================================================================
// Test Data Setup Helpers
// ============================================================================

export interface TestCounterparty {
    id: string;
    shortName: string;
    fullName: string;
    kind: "legal_entity" | "individual";
    customerId: string | null;
}

type TestCounterpartyOverrides = Partial<TestCounterparty> & {
    name?: string;
    isTreasury?: boolean;
};

export async function createTestCounterparty(overrides: TestCounterpartyOverrides = {}): Promise<TestCounterparty> {
    const isTreasury = overrides.isTreasury ?? false;
    const shortName = overrides.shortName ?? overrides.name ?? "Test Counterparty";
    const counterparty: TestCounterparty = {
        id: overrides.id ?? randomCounterpartyId(),
        shortName,
        fullName: overrides.fullName ?? shortName,
        kind: overrides.kind ?? "legal_entity",
        customerId: overrides.customerId ?? (isTreasury ? null : randomCustomerId()),
    };

    await db.insert(schema.counterparties).values(counterparty);
    return counterparty;
}

export interface TestCustomer {
    id: string;
    displayName: string;
}

export async function createTestCustomer(
    _counterpartyId: string,
    overrides: Partial<TestCustomer> = {}
): Promise<TestCustomer> {
    const customer = {
        id: overrides.id ?? randomCustomerId(),
        displayName: overrides.displayName ?? "Test Customer"
    };

    await db.insert(schema.customers).values(customer);
    return customer;
}

export interface TestBankAccount {
    id: string;
    counterpartyId: string;
    stableKey: string;
    currencyId: string;
    currency: string;
    label: string;
}

export async function createTestBankAccount(
    counterpartyId: string,
    overrides: Partial<TestBankAccount> = {}
): Promise<TestBankAccount> {
    const currency = overrides.currency ?? "USD";
    const account = {
        id: overrides.id ?? randomUUID(),
        counterpartyId,
        stableKey: overrides.stableKey ?? `bank-${Date.now()}`,
        currencyId: overrides.currencyId ?? currencyIdForCode(currency),
        label: overrides.label ?? "Test Bank Account",
        rail: "bank" as const
    };

    await db.insert(schema.bankAccounts).values(account);
    return { ...account, currency };
}

export interface TestPaymentOrder {
    id: string;
    customerCounterpartyId: string;
    customerId: string;
    status: string;
    payInCurrencyId: string;
    payInCurrency: string;
    payInExpectedMinor: bigint;
    payOutCurrencyId: string;
    payOutCurrency: string;
    payOutAmountMinor: bigint;
    payInCounterpartyId: string;
    payOutCounterpartyId: string;
    idempotencyKey: string;
}

export async function createTestPaymentOrder(
    params: {
        customerCounterpartyId: string;
        customerId: string;
        payInCounterpartyId: string;
        payOutCounterpartyId: string;
    },
    overrides: Partial<TestPaymentOrder> = {}
): Promise<TestPaymentOrder> {
    const payInCurrency = overrides.payInCurrency ?? "USD";
    const payOutCurrency = overrides.payOutCurrency ?? "EUR";
    const order = {
        id: overrides.id ?? randomOrderId(),
        customerCounterpartyId: params.customerCounterpartyId,
        customerId: params.customerId,
        status: overrides.status ?? "quote",
        payInCurrencyId: overrides.payInCurrencyId ?? currencyIdForCode(payInCurrency),
        payInExpectedMinor: overrides.payInExpectedMinor ?? 100000n,
        payOutCurrencyId: overrides.payOutCurrencyId ?? currencyIdForCode(payOutCurrency),
        payOutAmountMinor: overrides.payOutAmountMinor ?? 85000n,
        payInCounterpartyId: params.payInCounterpartyId,
        payOutCounterpartyId: params.payOutCounterpartyId,
        idempotencyKey: overrides.idempotencyKey ?? randomIdempotencyKey()
    };

    await db.insert(schema.paymentOrders).values(order);
    return { ...order, payInCurrency, payOutCurrency };
}

export interface TestFxQuote {
    id: string;
    fromCurrencyId: string;
    fromCurrency: string;
    toCurrencyId: string;
    toCurrency: string;
    fromAmountMinor: bigint;
    toAmountMinor: bigint;
    pricingMode: "auto_cross" | "explicit_route";
    pricingTrace: Record<string, unknown>;
    dealDirection: string | null;
    dealForm: string | null;
    rateNum: bigint;
    rateDen: bigint;
    status: "active" | "used" | "expired" | "cancelled";
    usedByRef: string | null;
    usedAt: Date | null;
    expiresAt: Date;
    idempotencyKey: string;
}

export async function createTestFxQuote(
    params: {
        fromCurrency: string;
        toCurrency: string;
        fromAmountMinor: bigint;
        toAmountMinor: bigint;
        idempotencyKey: string;
    },
    overrides: Partial<TestFxQuote> = {}
): Promise<TestFxQuote> {
    const fromCurrency = overrides.fromCurrency ?? params.fromCurrency;
    const toCurrency = overrides.toCurrency ?? params.toCurrency;
    const quote = {
        id: overrides.id ?? randomUUID(),
        fromCurrencyId: overrides.fromCurrencyId ?? currencyIdForCode(fromCurrency),
        toCurrencyId: overrides.toCurrencyId ?? currencyIdForCode(toCurrency),
        fromAmountMinor: params.fromAmountMinor,
        toAmountMinor: params.toAmountMinor,
        pricingMode: overrides.pricingMode ?? "auto_cross",
        pricingTrace: overrides.pricingTrace ?? { version: "v1", mode: "auto_cross" },
        dealDirection: overrides.dealDirection ?? null,
        dealForm: overrides.dealForm ?? null,
        rateNum: overrides.rateNum ?? 85n,
        rateDen: overrides.rateDen ?? 100n,
        status: overrides.status ?? "active",
        usedByRef: overrides.usedByRef ?? null,
        usedAt: overrides.usedAt ?? null,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
        idempotencyKey: params.idempotencyKey,
    } as const;

    await db.insert(schema.fxQuotes).values(quote);
    return { ...quote, fromCurrency, toCurrency };
}

/**
 * Create a complete test scenario with all required entities
 */
export interface TestScenario {
    treasuryCounterparty: TestCounterparty;
    branchCounterparty: TestCounterparty;
    payoutCounterparty: TestCounterparty;
    customer: TestCustomer;
    branchBankAccount: TestBankAccount;
    payoutBankAccount: TestBankAccount;
    order: TestPaymentOrder;
}

type TestScenarioOverrides = Partial<{
    payInCurrency: string;
    payOutCurrency: string;
    payInExpectedMinor: bigint;
    payOutAmountMinor: bigint;
    orderStatus: string;
}>;

export async function createTestScenario(
    overrides: TestScenarioOverrides = {}
): Promise<TestScenario> {
    // Create treasury counterparty and customer first; non-treasury counterparties reference a customer.
    const treasuryCounterparty = await createTestCounterparty({ name: "Treasury Corp", isTreasury: true });
    const customer = await createTestCustomer(treasuryCounterparty.id, { displayName: "Test Customer" });
    const branchCounterparty = await createTestCounterparty({ name: "Branch Corp", customerId: customer.id });
    const payoutCounterparty = await createTestCounterparty({ name: "Payout Corp", customerId: customer.id });

    // Create bank accounts
    const branchBankAccount = await createTestBankAccount(branchCounterparty.id, {
        stableKey: "branch-bank-usd",
        currency: overrides.payInCurrency ?? "USD",
        label: "Branch USD Account"
    });

    const payoutBankAccount = await createTestBankAccount(payoutCounterparty.id, {
        stableKey: "payout-bank-eur",
        currency: overrides.payOutCurrency ?? "EUR",
        label: "Payout EUR Account"
    });

    // Create payment order
    const order = await createTestPaymentOrder(
        {
            customerCounterpartyId: treasuryCounterparty.id,
            customerId: customer.id,
            payInCounterpartyId: branchCounterparty.id,
            payOutCounterpartyId: payoutCounterparty.id
        },
        {
            payInCurrency: overrides.payInCurrency ?? "USD",
            payOutCurrency: overrides.payOutCurrency ?? "EUR",
            payInExpectedMinor: overrides.payInExpectedMinor ?? 100000n,
            payOutAmountMinor: overrides.payOutAmountMinor ?? 85000n,
            status: overrides.orderStatus ?? "quote"
        }
    );

    return {
        treasuryCounterparty,
        branchCounterparty,
        payoutCounterparty,
        customer,
        branchBankAccount,
        payoutBankAccount,
        order
    };
}

// ============================================================================
// Query Helpers
// ============================================================================

export async function getPaymentOrder(orderId: string) {
    const orders = await db
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.id, orderId))
        .limit(1);

    return orders[0] || null;
}

export async function getJournalEntry(entryId: string) {
    const entries = await db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.id, entryId))
        .limit(1);

    return entries[0] || null;
}

export async function getJournalLines(entryId: string) {
    return await db
        .select()
        .from(schema.journalLines)
        .where(eq(schema.journalLines.entryId, entryId));
}

export async function getTbTransferPlans(entryId: string) {
    return await db
        .select()
        .from(schema.tbTransferPlans)
        .where(eq(schema.tbTransferPlans.journalEntryId, entryId));
}

export async function getOutboxEntry(refId: string) {
    const entries = await db
        .select()
        .from(schema.outbox)
        .where(eq(schema.outbox.refId, refId))
        .limit(1);

    return entries[0] || null;
}

export async function updateOrderStatus(orderId: string, status: string) {
    await db
        .update(schema.paymentOrders)
        .set({ status: status as any })
        .where(eq(schema.paymentOrders.id, orderId));
}

export async function updateOrderWithPendingTransferId(
    orderId: string,
    status: string,
    pendingTransferId: bigint
) {
    await db
        .update(schema.paymentOrders)
        .set({
            status: status as any,
            payoutPendingTransferId: pendingTransferId
        })
        .where(eq(schema.paymentOrders.id, orderId));
}

export { db, tb };
