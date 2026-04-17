import { createHash, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { bookAccountInstances, books } from "../../../packages/modules/ledger/src/schema";
import { fxQuoteLegs, fxQuotes } from "../../../packages/modules/treasury/src/schema";

import { createCommercialCoreRuntime } from "./runtime";

export const COMMERCIAL_CORE_ACTOR_USER_ID =
  "00000000-0000-4000-8000-000000009901";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function createLegalEntityPartyProfileBundle(input: {
  countryCode?: string | null;
  fullName: string;
  shortName: string;
}) {
  return {
    profile: {
      fullName: input.fullName,
      shortName: input.shortName,
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: input.countryCode ?? null,
      businessActivityCode: null,
      businessActivityText: null,
      businessActivityTextI18n: null,
    },
    identifiers: [],
    address: null,
    contacts: [],
    representatives: [],
    licenses: [],
  };
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
  const rub = await findCurrencyByCode("RUB");
  const customerName = uniqueLabel("Customer");
  const organizationShortName = uniqueLabel("Internal Org");
  const organizationFullName = `${organizationShortName} LLC`;
  const applicantShortName = uniqueLabel("Applicant");
  const applicantFullName = `${applicantShortName} LLC`;
  const beneficiaryShortName = uniqueLabel("Beneficiary");
  const beneficiaryFullName = `${beneficiaryShortName} GmbH`;
  const payerShortName = uniqueLabel("Payer");
  const payerFullName = `${payerShortName} LLC`;
  const providerDisplayName = uniqueLabel("Provider");

  const customer = await modules.parties.customers.commands.create({
    description: null,
    name: customerName,
    externalRef: null,
  });
  const organization = await modules.parties.organizations.commands.create({
    fullName: organizationFullName,
    shortName: organizationShortName,
    partyProfile: createLegalEntityPartyProfileBundle({
      fullName: organizationFullName,
      shortName: organizationShortName,
    }),
  });
  const applicant = await modules.parties.counterparties.commands.create({
    country: "US",
    customerId: customer.id,
    fullName: applicantFullName,
    shortName: applicantShortName,
    partyProfile: createLegalEntityPartyProfileBundle({
      countryCode: "US",
      fullName: applicantFullName,
      shortName: applicantShortName,
    }),
  });
  const externalBeneficiary = await modules.parties.counterparties.commands.create({
    country: "DE",
    fullName: beneficiaryFullName,
    shortName: beneficiaryShortName,
    partyProfile: createLegalEntityPartyProfileBundle({
      countryCode: "DE",
      fullName: beneficiaryFullName,
      shortName: beneficiaryShortName,
    }),
  });
  const externalPayer = await modules.parties.counterparties.commands.create({
    country: "AE",
    fullName: payerFullName,
    shortName: payerShortName,
    partyProfile: createLegalEntityPartyProfileBundle({
      countryCode: "AE",
      fullName: payerFullName,
      shortName: payerShortName,
    }),
  });
  const provider = await modules.parties.requisites.commands.createProvider({
    country: "US",
    displayName: providerDisplayName,
    identifiers: [
      {
        scheme: "swift",
        value: "BOFAUS3N",
        isPrimary: true,
      },
    ],
    kind: "bank",
    legalName: `${providerDisplayName} Bank`,
  });
  const organizationRequisite = await modules.parties.requisites.commands.create({
    beneficiaryName: organization.fullName,
    currencyId: usd.id,
    identifiers: [
      {
        scheme: "local_account_number",
        value: "40802810000000000001",
        isPrimary: true,
      },
    ],
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
    currencies: { eur, rub, usd },
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
  const sourceAmount = input.sourceAmount ?? "1000.00";
  const targetCurrencyId = input.targetCurrencyId ?? input.sourceCurrencyId;

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
        iban: "DE89370400440532013000",
        label: "Main payout bank",
        swift: "DEUTDEFF",
      },
      beneficiaryCounterpartyId: input.beneficiaryCounterpartyId,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: sourceAmount,
      expectedAt: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: "Supplier payment",
      sourceAmount,
      sourceCurrencyId: input.sourceCurrencyId,
      targetCurrencyId,
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
    agreementVersionId: null,
    agreementFeeBps: "150",
    agreementFeeAmountMinor: "1500",
    additionalExpensesAmountMinor: "0",
    additionalExpensesCurrencyId: null,
    additionalExpensesInBaseMinor: "0",
    additionalExpensesRateDen: null,
    additionalExpensesRateNum: null,
    additionalExpensesRateSource: null,
    baseCurrencyId: input.baseCurrencyId,
    calculationCurrencyId: input.calculationCurrencyId,
    calculationTimestamp: new Date("2026-01-06T10:00:00.000Z"),
    fixedFeeAmountMinor: "0",
    fixedFeeCurrencyId: null,
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
    pricingProvenance: null,
    quoteMarkupAmountMinor: "0",
    quoteMarkupBps: "0",
    quoteSnapshot: { source: "phase-0-fixture" },
    rateDen: input.rateDen.toString(),
    rateNum: input.rateNum.toString(),
    rateSource: "fx_quote",
    referenceRateAsOf: null,
    referenceRateDen: null,
    referenceRateNum: null,
    referenceRateSource: null,
    totalFeeAmountInBaseMinor: "1500",
    totalFeeAmountMinor: "1500",
    totalFeeBps: "150",
    totalAmountMinor: "101500",
    totalInBaseMinor: "91500",
    totalWithExpensesInBaseMinor: "91500",
  });
}
