import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { currencyIdForCode } from "@bedrock/db/seeds";

import { db } from "./setup";

// ============================================================================
// Random ID generators
// ============================================================================

function randomCounterpartyId() {
  return randomUUID();
}

function randomCustomerId() {
  return randomUUID();
}

function randomOrderId() {
  return randomUUID();
}

function randomIdempotencyKey() {
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

interface TestCounterparty {
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

async function createTestCounterparty(
  overrides: TestCounterpartyOverrides = {},
): Promise<TestCounterparty> {
  const isTreasury = overrides.isTreasury ?? false;
  const shortName =
    overrides.shortName ?? overrides.name ?? "Test Counterparty";
  const counterparty: TestCounterparty = {
    id: overrides.id ?? randomCounterpartyId(),
    shortName,
    fullName: overrides.fullName ?? shortName,
    kind: overrides.kind ?? "legal_entity",
    customerId:
      overrides.customerId ?? (isTreasury ? null : randomCustomerId()),
  };

  await db.insert(schema.counterparties).values(counterparty);
  return counterparty;
}

interface TestCustomer {
  id: string;
  displayName: string;
}

async function createTestCustomer(
  _counterpartyId: string,
  overrides: Partial<TestCustomer> = {},
): Promise<TestCustomer> {
  const customer = {
    id: overrides.id ?? randomCustomerId(),
    displayName: overrides.displayName ?? "Test Customer",
  };

  await db.insert(schema.customers).values(customer);
  return customer;
}

interface TestAccountProvider {
  id: string;
  type: "bank" | "exchange" | "blockchain" | "custodian";
  name: string;
  country: string;
}

async function createTestAccountProvider(
  overrides: Partial<TestAccountProvider> = {},
): Promise<TestAccountProvider> {
  const provider = {
    id: overrides.id ?? randomUUID(),
    type: overrides.type ?? ("bank" as const),
    name: overrides.name ?? `Test Bank ${Date.now()}`,
    country: overrides.country ?? "US",
  };

  await db.insert(schema.operationalAccountProviders).values(provider);
  return provider;
}

interface TestAccount {
  id: string;
  counterpartyId: string;
  accountProviderId: string;
  stableKey: string;
  currencyId: string;
  currency: string;
  label: string;
}

async function createTestAccount(
  counterpartyId: string,
  accountProviderId: string,
  overrides: Partial<TestAccount> = {},
): Promise<TestAccount> {
  const currency = overrides.currency ?? "USD";
  const account = {
    id: overrides.id ?? randomUUID(),
    counterpartyId,
    accountProviderId,
    stableKey: overrides.stableKey ?? `acct-${Date.now()}`,
    currencyId: overrides.currencyId ?? currencyIdForCode(currency),
    label: overrides.label ?? "Test Account",
  };

  await db.insert(schema.operationalAccounts).values(account);
  return { ...account, currency };
}

interface TestPaymentOrder {
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
  payInAccountId: string;
  payOutCounterpartyId: string;
  payOutAccountId: string;
  idempotencyKey: string;
}

async function createTestPaymentOrder(
  params: {
    customerCounterpartyId: string;
    customerId: string;
    payInCounterpartyId: string;
    payInAccountId: string;
    payOutCounterpartyId: string;
    payOutAccountId: string;
  },
  overrides: Partial<TestPaymentOrder> = {},
): Promise<TestPaymentOrder> {
  const payInCurrency = overrides.payInCurrency ?? "USD";
  const payOutCurrency = overrides.payOutCurrency ?? "EUR";
  const order = {
    id: overrides.id ?? randomOrderId(),
    customerCounterpartyId: params.customerCounterpartyId,
    customerId: params.customerId,
    status: overrides.status ?? "quote",
    payInCurrencyId:
      overrides.payInCurrencyId ?? currencyIdForCode(payInCurrency),
    payInExpectedMinor: overrides.payInExpectedMinor ?? 100000n,
    payOutCurrencyId:
      overrides.payOutCurrencyId ?? currencyIdForCode(payOutCurrency),
    payOutAmountMinor: overrides.payOutAmountMinor ?? 85000n,
    payInCounterpartyId: params.payInCounterpartyId,
    payInAccountId: params.payInAccountId,
    payOutCounterpartyId: params.payOutCounterpartyId,
    payOutAccountId: params.payOutAccountId,
    idempotencyKey: overrides.idempotencyKey ?? randomIdempotencyKey(),
  };

  await db.insert(schema.paymentOrders).values(order);
  return { ...order, payInCurrency, payOutCurrency };
}

interface TestFxQuote {
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
  overrides: Partial<TestFxQuote> = {},
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
    pricingTrace: overrides.pricingTrace ?? {
      version: "v1",
      mode: "auto_cross",
    },
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
interface TestScenario {
  treasuryCounterparty: TestCounterparty;
  branchCounterparty: TestCounterparty;
  payoutCounterparty: TestCounterparty;
  customer: TestCustomer;
  accountProvider: TestAccountProvider;
  branchAccount: TestAccount;
  payoutAccount: TestAccount;
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
  overrides: TestScenarioOverrides = {},
): Promise<TestScenario> {
  // Create treasury counterparty and customer first; non-treasury counterparties reference a customer.
  const treasuryCounterparty = await createTestCounterparty({
    name: "Treasury Corp",
    isTreasury: true,
  });
  const customer = await createTestCustomer(treasuryCounterparty.id, {
    displayName: "Test Customer",
  });
  const branchCounterparty = await createTestCounterparty({
    name: "Branch Corp",
    customerId: customer.id,
  });
  const payoutCounterparty = await createTestCounterparty({
    name: "Payout Corp",
    customerId: customer.id,
  });

  const accountProvider = await createTestAccountProvider({
    name: `Test Bank ${Date.now()}`,
  });

  const branchAccount = await createTestAccount(
    branchCounterparty.id,
    accountProvider.id,
    {
      stableKey: "branch-acct-usd",
      currency: overrides.payInCurrency ?? "USD",
      label: "Branch USD Account",
    },
  );

  const payoutAccount = await createTestAccount(
    payoutCounterparty.id,
    accountProvider.id,
    {
      stableKey: "payout-acct-eur",
      currency: overrides.payOutCurrency ?? "EUR",
      label: "Payout EUR Account",
    },
  );

  // Create payment order
  const order = await createTestPaymentOrder(
    {
      customerCounterpartyId: treasuryCounterparty.id,
      customerId: customer.id,
      payInCounterpartyId: branchCounterparty.id,
      payInAccountId: branchAccount.id,
      payOutCounterpartyId: payoutCounterparty.id,
      payOutAccountId: payoutAccount.id,
    },
    {
      payInCurrency: overrides.payInCurrency ?? "USD",
      payOutCurrency: overrides.payOutCurrency ?? "EUR",
      payInExpectedMinor: overrides.payInExpectedMinor ?? 100000n,
      payOutAmountMinor: overrides.payOutAmountMinor ?? 85000n,
      status: overrides.orderStatus ?? "quote",
    },
  );

  return {
    treasuryCounterparty,
    branchCounterparty,
    payoutCounterparty,
    customer,
    accountProvider,
    branchAccount,
    payoutAccount,
    order,
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

  const order = orders[0] || null;
  if (!order) return null;

  return order;
}

export async function getJournalEntry(entryId: string) {
  const entries = await db
    .select()
    .from(schema.ledgerOperations)
    .where(eq(schema.ledgerOperations.id, entryId))
    .limit(1);

  const entry = entries[0] || null;
  if (!entry) return null;

  return entry;
}

export async function getJournalLines(entryId: string) {
  const postings = await db
    .select()
    .from(schema.ledgerPostings)
    .where(eq(schema.ledgerPostings.operationId, entryId));

  if (postings.length === 0) {
    return [];
  }

  const accountIds = new Set<string>();
  for (const posting of postings) {
    accountIds.add(posting.debitBookAccountId);
    accountIds.add(posting.creditBookAccountId);
  }

  const accounts = await db
    .select({
      id: schema.bookAccounts.id,
      accountNo: schema.bookAccounts.accountNo,
    })
    .from(schema.bookAccounts)
    .where(inArray(schema.bookAccounts.id, Array.from(accountIds)));

  const accountById = new Map(
    accounts.map((account) => [account.id, account.accountNo]),
  );
  const lines: {
    entryId: string;
    side: "debit" | "credit";
    accountKey: string;
    amountMinor: bigint;
    lineNo: number;
  }[] = [];

  for (const posting of postings) {
    lines.push({
      entryId,
      side: "debit",
      accountKey: accountById.get(posting.debitBookAccountId) ?? "",
      amountMinor: posting.amountMinor,
      lineNo: posting.lineNo,
    });
    lines.push({
      entryId,
      side: "credit",
      accountKey: accountById.get(posting.creditBookAccountId) ?? "",
      amountMinor: posting.amountMinor,
      lineNo: posting.lineNo,
    });
  }

  return lines;
}

export async function getTbTransferPlans(entryId: string) {
  const plans = await db
    .select()
    .from(schema.tbTransferPlans)
    .where(eq(schema.tbTransferPlans.operationId, entryId));

  return plans;
}

export async function getOutboxEntry(refId: string) {
  const entries = await db
    .select()
    .from(schema.outbox)
    .where(eq(schema.outbox.refId, refId))
    .limit(1);

  const entry = entries[0] || null;
  if (!entry) return null;

  return entry;
}

export async function updateOrderStatus(orderId: string, status: string) {
  await db
    .update(schema.paymentOrders)
    .set({ status: status as any })
    .where(eq(schema.paymentOrders.id, orderId));
}

export { db };
