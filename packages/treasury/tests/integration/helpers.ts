import { db, tb } from "./setup";
import { schema } from "@bedrock/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// ============================================================================
// Random ID generators
// ============================================================================

export function randomOrgId() {
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

export interface TestOrg {
    id: string;
    name: string;
    isTreasury: boolean;
}

export async function createTestOrg(overrides: Partial<TestOrg> = {}): Promise<TestOrg> {
    const org = {
        id: overrides.id ?? randomOrgId(),
        name: overrides.name ?? "Test Organization",
        isTreasury: overrides.isTreasury ?? false,
        baseCurrency: "USD"
    };

    await db.insert(schema.organizations).values(org);
    return org;
}

export interface TestCustomer {
    id: string;
    orgId: string;
    displayName: string;
}

export async function createTestCustomer(
    orgId: string,
    overrides: Partial<TestCustomer> = {}
): Promise<TestCustomer> {
    const customer = {
        id: overrides.id ?? randomCustomerId(),
        orgId,
        displayName: overrides.displayName ?? "Test Customer"
    };

    await db.insert(schema.customers).values(customer);
    return customer;
}

export interface TestBankAccount {
    id: string;
    orgId: string;
    stableKey: string;
    currency: string;
    label: string;
}

export async function createTestBankAccount(
    orgId: string,
    overrides: Partial<TestBankAccount> = {}
): Promise<TestBankAccount> {
    const account = {
        id: overrides.id ?? randomUUID(),
        orgId,
        stableKey: overrides.stableKey ?? `bank-${Date.now()}`,
        currency: overrides.currency ?? "USD",
        label: overrides.label ?? "Test Bank Account",
        rail: "bank" as const
    };

    await db.insert(schema.bankAccounts).values(account);
    return account;
}

export interface TestPaymentOrder {
    id: string;
    treasuryOrgId: string;
    customerOrgId: string;
    customerId: string;
    status: string;
    payInCurrency: string;
    payInExpectedMinor: bigint;
    payOutCurrency: string;
    payOutAmountMinor: bigint;
    payInOrgId: string;
    payOutOrgId: string;
    idempotencyKey: string;
}

export async function createTestPaymentOrder(
    params: {
        treasuryOrgId: string;
        customerOrgId: string;
        customerId: string;
        payInOrgId: string;
        payOutOrgId: string;
    },
    overrides: Partial<TestPaymentOrder> = {}
): Promise<TestPaymentOrder> {
    const order = {
        id: overrides.id ?? randomOrderId(),
        treasuryOrgId: params.treasuryOrgId,
        customerOrgId: params.customerOrgId,
        customerId: params.customerId,
        status: overrides.status ?? "quote",
        payInCurrency: overrides.payInCurrency ?? "USD",
        payInExpectedMinor: overrides.payInExpectedMinor ?? 100000n,
        payOutCurrency: overrides.payOutCurrency ?? "EUR",
        payOutAmountMinor: overrides.payOutAmountMinor ?? 85000n,
        payInOrgId: params.payInOrgId,
        payOutOrgId: params.payOutOrgId,
        idempotencyKey: overrides.idempotencyKey ?? randomIdempotencyKey()
    };

    await db.insert(schema.paymentOrders).values(order);
    return order;
}

export interface TestFxPolicy {
    id: string;
    name: string;
    marginBps: number;
    feeBps: number;
    ttlSeconds: number;
    isActive: boolean;
}

export async function createTestFxPolicy(
    overrides: Partial<TestFxPolicy> = {}
): Promise<TestFxPolicy> {
    const policy = {
        id: overrides.id ?? randomUUID(),
        name: overrides.name ?? `test-policy-${Date.now()}`,
        marginBps: overrides.marginBps ?? 20,
        feeBps: overrides.feeBps ?? 10,
        ttlSeconds: overrides.ttlSeconds ?? 600,
        isActive: overrides.isActive ?? true,
    };

    await db.insert(schema.fxPolicies).values(policy);
    return policy;
}

export interface TestFxQuote {
    id: string;
    policyId: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: bigint;
    toAmountMinor: bigint;
    feeFromMinor: bigint;
    spreadFromMinor: bigint;
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
    const policyId = overrides.policyId ?? (await createTestFxPolicy()).id;
    const quote = {
        id: overrides.id ?? randomUUID(),
        policyId,
        fromCurrency: params.fromCurrency,
        toCurrency: params.toCurrency,
        fromAmountMinor: params.fromAmountMinor,
        toAmountMinor: params.toAmountMinor,
        feeFromMinor: overrides.feeFromMinor ?? 0n,
        spreadFromMinor: overrides.spreadFromMinor ?? 0n,
        rateNum: overrides.rateNum ?? 85n,
        rateDen: overrides.rateDen ?? 100n,
        status: overrides.status ?? "active",
        usedByRef: overrides.usedByRef ?? null,
        usedAt: overrides.usedAt ?? null,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
        idempotencyKey: params.idempotencyKey,
    } as const;

    await db.insert(schema.fxQuotes).values(quote);
    return quote;
}

/**
 * Create a complete test scenario with all required entities
 */
export interface TestScenario {
    treasuryOrg: TestOrg;
    branchOrg: TestOrg;
    payoutOrg: TestOrg;
    customer: TestCustomer;
    branchBankAccount: TestBankAccount;
    payoutBankAccount: TestBankAccount;
    order: TestPaymentOrder;
}

export async function createTestScenario(
    overrides: {
        payInCurrency?: string;
        payOutCurrency?: string;
        payInExpectedMinor?: bigint;
        payOutAmountMinor?: bigint;
        orderStatus?: string;
    } = {}
): Promise<TestScenario> {
    // Create organizations
    const treasuryOrg = await createTestOrg({ name: "Treasury Corp", isTreasury: true });
    const branchOrg = await createTestOrg({ name: "Branch Corp" });
    const payoutOrg = await createTestOrg({ name: "Payout Corp" });

    // Create customer under treasury org
    const customer = await createTestCustomer(treasuryOrg.id, { displayName: "Test Customer" });

    // Create bank accounts
    const branchBankAccount = await createTestBankAccount(branchOrg.id, {
        stableKey: "branch-bank-usd",
        currency: overrides.payInCurrency ?? "USD",
        label: "Branch USD Account"
    });

    const payoutBankAccount = await createTestBankAccount(payoutOrg.id, {
        stableKey: "payout-bank-eur",
        currency: overrides.payOutCurrency ?? "EUR",
        label: "Payout EUR Account"
    });

    // Create payment order
    const order = await createTestPaymentOrder(
        {
            treasuryOrgId: treasuryOrg.id,
            customerOrgId: treasuryOrg.id,
            customerId: customer.id,
            payInOrgId: branchOrg.id,
            payOutOrgId: payoutOrg.id
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
        treasuryOrg,
        branchOrg,
        payoutOrg,
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
