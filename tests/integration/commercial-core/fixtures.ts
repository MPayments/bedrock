import { createHash, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { bookAccountInstances, books } from "../../../packages/modules/ledger/src/schema";
import { fxQuoteLegs, fxQuotes } from "../../../packages/modules/treasury/src/schema";

import { createCommercialCoreRuntime } from "./runtime";

export const COMMERCIAL_CORE_ACTOR_USER_ID =
  "00000000-0000-4000-8000-000000000901";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function findCurrencyByCode(code: string) {
  const runtime = createCommercialCoreRuntime();
  const result = await runtime.pool.query<{ code: string; id: string }>(
    "select id, code from currencies where code = $1 limit 1",
    [code],
  );
  const currency = result.rows[0];

  if (!currency) {
    throw new Error(`Missing seeded currency: ${code}`);
  }

  return currency;
}

export async function createCommercialPartiesFixture() {
  const runtime = createCommercialCoreRuntime();
  const { modules } = runtime;
  const usd = await findCurrencyByCode("USD");
  const eur = await findCurrencyByCode("EUR");

  const customer = await modules.parties.customers.commands.create({
    description: null,
    displayName: uniqueLabel("Customer"),
    externalRef: null,
  });
  const organization = await modules.parties.organizations.commands.create({
    fullName: `${uniqueLabel("Internal Org")} LLC`,
    shortName: uniqueLabel("Internal Org"),
  });
  const applicant = await modules.parties.counterparties.commands.create({
    country: "US",
    customerId: customer.id,
    fullName: `${uniqueLabel("Applicant")} LLC`,
    shortName: uniqueLabel("Applicant"),
  });
  const externalBeneficiary = await modules.parties.counterparties.commands.create({
    country: "DE",
    fullName: `${uniqueLabel("Beneficiary")} GmbH`,
    shortName: uniqueLabel("Beneficiary"),
  });
  const externalPayer = await modules.parties.counterparties.commands.create({
    country: "AE",
    fullName: `${uniqueLabel("Payer")} LLC`,
    shortName: uniqueLabel("Payer"),
  });
  const provider = await modules.parties.requisites.commands.createProvider({
    country: "US",
    kind: "bank",
    name: uniqueLabel("Provider"),
    swift: "BOFAUS3N",
  });
  const organizationRequisite = await modules.parties.requisites.commands.create({
    accountNo: "40802810000000000001",
    beneficiaryName: organization.fullName,
    currencyId: usd.id,
    kind: "bank",
    label: uniqueLabel("Org Requisite"),
    ownerId: organization.id,
    ownerType: "organization",
    providerId: provider.id,
  });

  const [book] = await runtime.db
    .insert(books)
    .values({
      code: `itest-commercial-${randomUUID().slice(0, 8)}`,
      isDefault: true,
      name: "Commercial Core Test Book",
      ownerId: organization.id,
    })
    .returning();
  const [accountInstance] = await runtime.db
    .insert(bookAccountInstances)
    .values({
      accountNo: "1010",
      bookId: book!.id,
      currency: usd.code,
      dimensions: {},
      dimensionsHash: createHash("sha256").update("{}").digest("hex"),
      tbAccountId: 1n,
      tbLedger: 1,
    })
    .returning();

  await modules.parties.requisites.commands.upsertBinding({
    bookAccountInstanceId: accountInstance!.id,
    bookId: book!.id,
    postingAccountNo: "1010",
    requisiteId: organizationRequisite.id,
  });

  return {
    applicant,
    currencies: { eur, usd },
    customer,
    externalBeneficiary,
    externalPayer,
    organization,
    organizationRequisite,
    provider,
    runtime,
  };
}

export async function createAgreementFixture() {
  const fixture = await createCommercialPartiesFixture();
  const agreement = await fixture.runtime.modules.agreements.agreements.commands.create({
    actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
    contractDate: new Date("2026-01-05T00:00:00.000Z"),
    contractNumber: uniqueLabel("AGR"),
    customerId: fixture.customer.id,
    feeRules: [
      {
        kind: "fixed_fee",
        currencyId: fixture.currencies.usd.id,
        unit: "money",
        value: "15.00",
      },
    ],
    idempotencyKey: randomUUID(),
    organizationId: fixture.organization.id,
    organizationRequisiteId: fixture.organizationRequisite.id,
  });

  return {
    ...fixture,
    agreement,
  };
}

export function createPaymentIntakeDraft(input: {
  applicantCounterpartyId: string;
  beneficiaryCounterpartyId: string;
  sourceAmount?: string;
  sourceCurrencyId: string;
  targetCurrencyId?: string | null;
}) {
  return {
    common: {
      applicantCounterpartyId: input.applicantCounterpartyId,
      customerNote: "Characterization draft",
      requestedExecutionDate: new Date("2026-01-10T00:00:00.000Z"),
    },
    externalBeneficiary: {
      bankInstructionSnapshot: {
        accountNo: "DE89370400440532013000",
        bankAddress: "Test bank street",
        bankCountry: "DE",
        bankName: "Beneficiary Bank",
        beneficiaryName: "Beneficiary GmbH",
        bic: "DEUTDEFF",
        corrAccount: null,
        iban: "DE89370400440532013000",
        label: "Main payout bank",
        swift: "DEUTDEFF",
      },
      beneficiaryCounterpartyId: input.beneficiaryCounterpartyId,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: null,
      expectedAt: null,
      expectedCurrencyId: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: "Supplier payment",
      sourceAmount: input.sourceAmount ?? "1000.00",
      sourceCurrencyId: input.sourceCurrencyId,
      targetCurrencyId: input.targetCurrencyId ?? null,
    },
    settlementDestination: {
      bankInstructionSnapshot: null,
      mode: null,
      requisiteId: null,
    },
    type: "payment" as const,
  };
}

export async function createFxQuoteFixture(input: {
  dealId: string;
  fromAmountMinor: bigint;
  fromCurrencyId: string;
  rateDen: bigint;
  rateNum: bigint;
  toAmountMinor: bigint;
  toCurrencyId: string;
}) {
  const runtime = createCommercialCoreRuntime();
  const quoteId = randomUUID();
  const now = new Date("2026-01-06T10:00:00.000Z");

  await runtime.db.insert(fxQuotes).values({
    createdAt: now,
    dealDirection: null,
    dealForm: null,
    dealId: input.dealId,
    expiresAt: new Date("2026-01-06T10:30:00.000Z"),
    fromAmountMinor: input.fromAmountMinor,
    fromCurrencyId: input.fromCurrencyId,
    id: quoteId,
    idempotencyKey: `itest-commercial-quote-${quoteId}`,
    pricingMode: "auto_cross",
    pricingTrace: { source: "phase-0-fixture" },
    rateDen: input.rateDen,
    rateNum: input.rateNum,
    status: "active",
    toAmountMinor: input.toAmountMinor,
    toCurrencyId: input.toCurrencyId,
    usedAt: null,
    usedByRef: null,
    usedDocumentId: null,
  });
  await runtime.db.insert(fxQuoteLegs).values({
    asOf: now,
    executionCounterpartyId: null,
    fromAmountMinor: input.fromAmountMinor,
    fromCurrencyId: input.fromCurrencyId,
    id: randomUUID(),
    idx: 1,
    quoteId,
    rateDen: input.rateDen,
    rateNum: input.rateNum,
    sourceKind: "derived",
    sourceRef: "phase-0",
    toAmountMinor: input.toAmountMinor,
    toCurrencyId: input.toCurrencyId,
  });

  const [quote] = await runtime.db
    .select({
      dealId: fxQuotes.dealId,
      fromCurrencyId: fxQuotes.fromCurrencyId,
      id: fxQuotes.id,
      rateDen: fxQuotes.rateDen,
      rateNum: fxQuotes.rateNum,
      status: fxQuotes.status,
      toCurrencyId: fxQuotes.toCurrencyId,
    })
    .from(fxQuotes)
    .where(eq(fxQuotes.id, quoteId))
    .limit(1);

  return quote!;
}

export async function createCalculationFixture(input: {
  baseCurrencyId: string;
  calculationCurrencyId: string;
  fxQuoteId: string;
  rateDen: bigint;
  rateNum: bigint;
}) {
  const runtime = createCommercialCoreRuntime();

  return runtime.modules.calculations.calculations.commands.create({
    actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
    additionalExpensesAmountMinor: "0",
    additionalExpensesCurrencyId: null,
    additionalExpensesInBaseMinor: "0",
    additionalExpensesRateDen: null,
    additionalExpensesRateNum: null,
    additionalExpensesRateSource: null,
    baseCurrencyId: input.baseCurrencyId,
    calculationCurrencyId: input.calculationCurrencyId,
    calculationTimestamp: new Date("2026-01-06T10:00:00.000Z"),
    feeAmountInBaseMinor: "1500",
    feeAmountMinor: "1500",
    feeBps: "150",
    financialLines: [
      {
        amountMinor: "1500",
        currencyId: input.baseCurrencyId,
        kind: "fee_revenue",
      },
      {
        amountMinor: "-250",
        currencyId: input.baseCurrencyId,
        kind: "spread_revenue",
      },
    ],
    fxQuoteId: input.fxQuoteId,
    idempotencyKey: randomUUID(),
    originalAmountMinor: "100000",
    quoteSnapshot: { source: "phase-0-fixture" },
    rateDen: input.rateDen.toString(),
    rateNum: input.rateNum.toString(),
    rateSource: "fx_quote",
    totalAmountMinor: "101500",
    totalInBaseMinor: "91500",
    totalWithExpensesInBaseMinor: "91500",
  });
}
