import { describe, expect, it, vi } from "vitest";

import { createAcceptanceDocumentModule } from "../src/documents/acceptance";
import { createExchangeDocumentModule } from "../src/documents/exchange";
import { createInvoiceDocumentModule } from "../src/documents/invoice";

function createQuoteSnapshot() {
  return {
    quoteId: "00000000-0000-4000-8000-000000000010",
    quoteRef: "quote-ref-1",
    idempotencyKey: "quote-ref-1",
    fromCurrency: "USD",
    toCurrency: "EUR",
    fromAmountMinor: "10000",
    toAmountMinor: "9200",
    pricingMode: "explicit_route" as const,
    rateNum: "23",
    rateDen: "25",
    expiresAt: "2026-03-03T10:10:00.000Z",
    pricingTrace: { version: "v1", mode: "explicit_route" },
    legs: [
      {
        idx: 1,
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        toAmountMinor: "9200",
        rateNum: "23",
        rateDen: "25",
        sourceKind: "manual" as const,
        sourceRef: "desk",
        asOf: "2026-03-03T10:00:00.000Z",
        executionCounterpartyId: null,
      },
    ],
    financialLines: [],
    snapshotHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
}

function createDeps() {
  return {
    dealFx: {
      resolveDealFxContext: vi.fn(async () => null),
    },
    documentBusinessLinks: {
      findDealIdByDocumentId: vi.fn(async () => null),
    },
    documentRelations: {
      loadInvoice: vi.fn(async () => {
        throw new Error("loadInvoice not configured");
      }),
      getInvoiceExchangeChild: vi.fn(async () => null),
      getInvoiceAcceptanceChild: vi.fn(async () => null),
      getExchangeAcceptance: vi.fn(async () => null),
    },
    quoteSnapshot: {
      loadQuoteSnapshot: vi.fn(async () => createQuoteSnapshot()),
      createQuoteSnapshot: vi.fn(async () => createQuoteSnapshot()),
    },
    quoteUsage: {
      markQuoteUsedForInvoice: vi.fn(async () => undefined),
    },
    requisiteBindings: {
      resolveBinding: vi.fn(async () => ({
        requisiteId: "00000000-0000-4000-8000-000000000111",
        bookId: "00000000-0000-4000-8000-000000000112",
        organizationId: "00000000-0000-4000-8000-000000000113",
        currencyCode: "USD",
        postingAccountNo: "1010",
        bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
      })),
    },
    partyReferences: {
      assertCustomerExists: vi.fn(async () => undefined),
      assertCounterpartyExists: vi.fn(async () => undefined),
    },
  };
}

function createDealFxContext() {
  return {
    calculationCurrency: "USD",
    calculationId: "00000000-0000-4000-8000-000000000401",
    dealId: "00000000-0000-4000-8000-000000000402",
    dealType: "payment",
    financialLines: [],
    fundingResolution: {
      availableMinor: null,
      fundingOrganizationId: "00000000-0000-4000-8000-000000000113",
      fundingRequisiteId: null,
      reasonCode: "inventory_insufficient",
      requiredAmountMinor: "9200",
      state: "resolved" as const,
      strategy: "external_fx" as const,
      targetCurrency: "EUR",
      targetCurrencyId: "00000000-0000-4000-8000-000000000410",
    },
    hasConvertLeg: true,
    originalAmountMinor: "10000",
    quoteSnapshot: createQuoteSnapshot(),
    totalAmountMinor: "10150",
  };
}

function createPostedInvoice() {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    docType: "invoice",
    docNo: "INV-1",
    payloadVersion: 1,
    payload: {
      occurredAt: "2026-03-03T10:00:00.000Z",
      customerId: "00000000-0000-4000-8000-000000000301",
      counterpartyId: "00000000-0000-4000-8000-000000000302",
      organizationId: "00000000-0000-4000-8000-000000000113",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
      amount: "101.5",
      amountMinor: "10150",
      currency: "USD",
      financialLines: [],
      memo: "exchange invoice",
    },
    occurredAt: new Date("2026-03-03T10:00:00.000Z"),
    lifecycleStatus: "active",
    postingStatus: "posted",
  };
}

describe("commercial document modules", () => {
  it("rejects invoice creation when invoice currency mismatches the selected requisite", async () => {
    const deps = createDeps();

    const module = createInvoiceDocumentModule(deps as any);

    await expect(
      module.canCreate?.(
        { db: {} } as any,
        {
          occurredAt: new Date("2026-03-03T10:00:00.000Z"),
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          organizationId: "00000000-0000-4000-8000-000000000113",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          amount: "100.00",
          amountMinor: "10000",
          currency: "EUR",
          financialLines: [],
          memo: "invoice",
        },
      ),
    ).rejects.toThrow("Currency mismatch: invoice=EUR, account=USD");
  });

  it("rejects invoice creation when referenced parties are missing", async () => {
    const deps = createDeps();
    deps.partyReferences.assertCounterpartyExists = vi.fn(async () => {
      throw new Error("Counterparty not found: 00000000-0000-4000-8000-000000000302");
    });

    const module = createInvoiceDocumentModule(deps as any);

    await expect(
      module.canCreate?.(
        { db: {} } as any,
        {
          occurredAt: new Date("2026-03-03T10:00:00.000Z"),
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          organizationId: "00000000-0000-4000-8000-000000000113",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          amount: "100.00",
          currency: "USD",
          financialLines: [],
          memo: "invoice",
          amountMinor: "10000",
        },
      ),
    ).rejects.toThrow(
      "Counterparty not found: 00000000-0000-4000-8000-000000000302",
    );
    expect(deps.partyReferences.assertCustomerExists).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000301",
    );
    expect(deps.partyReferences.assertCounterpartyExists).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000302",
    );
  });

  it("compiles percent financial lines into direct invoice draft payload", async () => {
    const module = createInvoiceDocumentModule(createDeps() as any);

    const draft = await module.createDraft?.(
      { db: {} } as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        customerId: "00000000-0000-4000-8000-000000000301",
        counterpartyId: "00000000-0000-4000-8000-000000000302",
        organizationId: "00000000-0000-4000-8000-000000000113",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
        amount: "100.00",
        amountMinor: "10000",
        currency: "USD",
        financialLines: [
          {
            calcMethod: "percent",
            bucket: "fee_revenue",
            currency: "USD",
            percent: "1.25",
          },
        ],
        memo: "invoice",
      },
    );

    expect(draft?.payload).toMatchObject({
      financialLines: [
        {
          calcMethod: "percent",
          percentBps: 125,
          currency: "USD",
          amountMinor: "125",
          source: "manual",
        },
      ],
    });
  });

  it("creates exchange drafts from linked deal FX context", async () => {
    const deps = createDeps();
    const invoice = createPostedInvoice();
    deps.documentRelations.loadInvoice = vi.fn(async () => invoice);
    deps.documentBusinessLinks.findDealIdByDocumentId = vi.fn(
      async () => "00000000-0000-4000-8000-000000000402",
    );
    deps.dealFx.resolveDealFxContext = vi.fn(async () => createDealFxContext());

    const module = createExchangeDocumentModule(deps as any);
    const draft = await module.createDraft?.(
      {
        runtime: {},
      } as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        executionRef: "exec-1",
        invoiceDocumentId: invoice.id,
        memo: "exchange invoice",
      },
    );

    expect(draft?.payload).toMatchObject({
      quoteSnapshot: expect.objectContaining({
        quoteId: "00000000-0000-4000-8000-000000000010",
      }),
    });
  });

  it("builds an exchange parent link from the draft payload", async () => {
    const module = createExchangeDocumentModule(createDeps() as any);

    await expect(
      module.buildInitialLinks?.(
        { db: {} } as any,
        {
          id: "00000000-0000-4000-8000-000000000401",
          docType: "exchange",
          docNo: "EX-1",
          occurredAt: new Date("2026-03-04T10:00:00.000Z"),
          payload: {
            occurredAt: "2026-03-04T10:00:00.000Z",
            invoiceDocumentId: "00000000-0000-4000-8000-000000000201",
            customerId: "00000000-0000-4000-8000-000000000301",
            counterpartyId: "00000000-0000-4000-8000-000000000302",
            organizationId: "00000000-0000-4000-8000-000000000113",
            organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
            executionRef: "exec-1",
            quoteSnapshot: createQuoteSnapshot(),
            memo: "exchange",
          },
        } as any,
      ),
    ).resolves.toEqual([
      {
        toDocumentId: "00000000-0000-4000-8000-000000000201",
        linkType: "parent",
      },
    ]);
  });

  it("requires a posted exchange before creating acceptance for exchange-mode invoices", async () => {
    const deps = createDeps();
    deps.documentRelations.loadInvoice = vi.fn(async () =>
      createPostedInvoice(),
    );
    deps.documentBusinessLinks.findDealIdByDocumentId = vi.fn(
      async () => "00000000-0000-4000-8000-000000000402",
    );
    deps.dealFx.resolveDealFxContext = vi.fn(async () => createDealFxContext());

    const module = createAcceptanceDocumentModule(deps as any);

    await expect(
      module.createDraft?.(
        { db: {} } as any,
        {
          occurredAt: new Date("2026-03-05T10:00:00.000Z"),
          invoiceDocumentId: "00000000-0000-4000-8000-000000000201",
          memo: "acceptance",
        },
      ),
    ).rejects.toThrow(
      "acceptance requires a posted exchange for FX-linked invoices",
    );
  });

  it("adds both invoice and exchange links for acceptance drafts with exchange dependency", async () => {
    const module = createAcceptanceDocumentModule(createDeps() as any);

    await expect(
      module.buildInitialLinks?.(
        { db: {} } as any,
        {
          id: "00000000-0000-4000-8000-000000000501",
          docType: "acceptance",
          docNo: "ACC-1",
          occurredAt: new Date("2026-03-05T10:00:00.000Z"),
          payload: {
            occurredAt: "2026-03-05T10:00:00.000Z",
            invoiceDocumentId: "00000000-0000-4000-8000-000000000201",
            exchangeDocumentId: "00000000-0000-4000-8000-000000000401",
            memo: "acceptance",
          },
        } as any,
      ),
    ).resolves.toEqual([
      {
        toDocumentId: "00000000-0000-4000-8000-000000000201",
        linkType: "parent",
      },
      {
        toDocumentId: "00000000-0000-4000-8000-000000000401",
        linkType: "depends_on",
      },
    ]);
  });
});
