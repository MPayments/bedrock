import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrganizations = vi.fn();
const getFxQuoteDetails = vi.fn();
const getFxQuotes = vi.fn();
const getRateSources = vi.fn();
const getServerSessionSnapshot = vi.fn();
const getDocumentDetails = vi.fn();
const getRequisiteById = vi.fn();
const getTreasuryReferenceData = vi.fn();
const listExecutionInstructions = vi.fn();
const listTreasuryAccounts = vi.fn();
const listTreasuryOperations = vi.fn();
const listTreasuryPositions = vi.fn();
const listUnmatchedExternalRecords = vi.fn();
const getDocumentFormOptions = vi.fn();
const createEmptyDocumentFormOptions = vi.fn(() => ({
  counterparties: [],
  customers: [],
  organizations: [],
  currencies: [],
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href }, children),
}));

vi.mock("@/components/data-table/skeleton", () => ({
  DataTableSkeleton: () => React.createElement("div", null, "data-table-skeleton"),
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSessionSnapshot,
}));

vi.mock("@/features/operations/documents/lib/queries", () => ({
  getDocumentDetails,
}));

vi.mock("@/features/documents/lib/form-options", () => ({
  getDocumentFormOptions,
  createEmptyDocumentFormOptions,
}));

vi.mock("@/features/entities/requisites/lib/queries", () => ({
  getRequisiteById,
}));

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({
    actions,
    children,
    description,
    title,
  }: {
    actions?: React.ReactNode;
    children?: React.ReactNode;
    description?: string;
    title: string;
  }) =>
    React.createElement(
      "section",
      null,
      React.createElement("h1", null, title),
      React.createElement("p", null, description),
      React.createElement("div", null, actions),
      React.createElement("div", null, children),
    ),
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizations,
}));

vi.mock("@/features/treasury/workbench/lib/reference-data", () => ({
  getTreasuryReferenceData,
}));

vi.mock("@/features/treasury/workbench/lib/queries", () => ({
  listExecutionInstructions,
  listTreasuryAccounts,
  listTreasuryOperations,
  listTreasuryPositions,
  listUnmatchedExternalRecords,
}));

vi.mock("@/features/treasury/quotes/lib/queries", () => ({
  getFxQuoteDetails,
  getFxQuotes,
}));

vi.mock("@/features/treasury/rates/lib/queries", () => ({
  getRateSources,
}));

vi.mock("@/features/treasury/workbench/components/create-operation-form", () => ({
  TreasuryOperationCreateForm: () =>
    React.createElement("div", null, "create-operation-form"),
}));

vi.mock("@/features/treasury/workbench/components/operations-table", () => ({
  TreasuryOperationsTable: () => React.createElement("div", null, "operations-table"),
}));

vi.mock("@/features/treasury/workbench/components/positions-table", () => ({
  TreasuryPositionsTable: () => React.createElement("div", null, "positions-table"),
}));

vi.mock("@/features/treasury/workbench/components/unmatched-records-table", () => ({
  TreasuryUnmatchedRecordsTable: () => React.createElement("div", null, "unmatched-table"),
}));

vi.mock("@/features/treasury/quotes/components/table", () => ({
  FxQuotesTable: () => React.createElement("div", null, "quotes-table"),
}));

vi.mock("@/features/treasury/quotes/components/treasury-fx-create-form", () => ({
  TreasuryFxCreateForm: () => React.createElement("div", null, "treasury-fx-create-form"),
}));

vi.mock("@/features/treasury/quotes/components/quote-detail", () => ({
  FxQuoteDetail: () => React.createElement("div", null, "quote-detail"),
}));

const referenceData = {
  assetLabels: {
    "asset-usd": "USD",
    "asset-eur": "EUR",
  },
  counterpartyLabels: {},
  customerLabels: {},
  organizationLabels: {
    "org-1": "Multihansa",
  },
  providerLabels: {},
};

describe("treasury workspace pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    listTreasuryAccounts.mockResolvedValue([
      {
        id: "account-1",
        assetId: "asset-usd",
        ownerEntityId: "org-1",
        operatorEntityId: "org-1",
        kind: "bank",
        accountReference: "main-usd",
        providerId: "provider-1",
        networkOrRail: null,
        canReceive: true,
        canSend: true,
        metadata: null,
      },
    ]);
    listTreasuryOperations.mockResolvedValue([]);
    listExecutionInstructions.mockResolvedValue([]);
    listUnmatchedExternalRecords.mockResolvedValue([]);
    listTreasuryPositions.mockResolvedValue([]);
    getOrganizations.mockResolvedValue({
      data: [{ id: "org-1", shortName: "Multihansa" }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    getServerSessionSnapshot.mockResolvedValue({ role: "admin" });
    getDocumentFormOptions.mockResolvedValue({
      counterparties: [],
      customers: [],
      organizations: [],
      currencies: [],
    });
    getTreasuryReferenceData.mockResolvedValue(referenceData);
    getFxQuotes.mockResolvedValue({
      data: [
        {
          id: "quote-1",
          fromCurrency: "USD",
          toCurrency: "EUR",
          fromAmount: "1000",
          toAmount: "915",
          status: "active",
          createdAt: "2026-03-27T10:00:00.000Z",
        },
      ],
    });
    getFxQuoteDetails.mockResolvedValue({
      quote: {
        id: "quote-1",
        idempotencyKey: "quote-ref-1",
        fromCurrencyId: "currency-usd",
        toCurrencyId: "currency-eur",
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "100000",
        toAmountMinor: "91500",
        pricingMode: "auto_cross",
        pricingTrace: {},
        dealDirection: null,
        dealForm: null,
        rateNum: "915",
        rateDen: "1000",
        status: "used",
        usedByRef: "fx_execute:document-1",
        usedAt: "2026-03-27T10:30:00.000Z",
        expiresAt: "2026-03-27T10:15:00.000Z",
        createdAt: "2026-03-27T10:00:00.000Z",
      },
      legs: [],
      feeComponents: [],
      financialLines: [],
      pricingTrace: {},
    });
    getDocumentDetails.mockResolvedValue({
      document: {
        id: "document-1",
        docType: "fx_execute",
        docNo: "FX-1",
        payloadVersion: 1,
        payload: {
          occurredAt: "2026-03-27T10:00:00.000Z",
          ownershipMode: "cross_org",
          sourceOrganizationId: "org-1",
          sourceRequisiteId: "00000000-0000-4000-8000-000000000111",
          destinationOrganizationId: "org-1",
          destinationRequisiteId: "00000000-0000-4000-8000-000000000112",
          amount: "1000",
          amountMinor: "100000",
          executionRef: "FX-EXEC-1",
          financialLines: [],
          quoteSnapshot: {
            quoteId: "quote-1",
            idempotencyKey: "quote-ref-1",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: "100000",
            toAmountMinor: "91500",
            pricingMode: "auto_cross",
            rateNum: "915",
            rateDen: "1000",
            expiresAt: "2026-03-27T10:15:00.000Z",
            pricingTrace: {},
            legs: [
              {
                idx: 1,
                fromCurrency: "USD",
                toCurrency: "EUR",
                fromAmountMinor: "100000",
                toAmountMinor: "91500",
                rateNum: "915",
                rateDen: "1000",
                sourceKind: "bank",
                sourceRef: null,
                asOf: "2026-03-27T10:00:00.000Z",
                executionCounterpartyId: null,
              },
            ],
            financialLines: [],
            snapshotHash:
              "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        },
        title: "Казначейский FX",
        occurredAt: "2026-03-27T10:00:00.000Z",
        submissionStatus: "draft",
        approvalStatus: "not_required",
        postingStatus: "unposted",
        lifecycleStatus: "active",
        allowedActions: [],
        createIdempotencyKey: null,
        amount: "1000",
        currency: "USD",
        memo: null,
        counterpartyId: null,
        customerId: null,
        organizationRequisiteId: null,
        searchText: "",
        createdBy: "user-1",
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        cancelledBy: null,
        cancelledAt: null,
        postingStartedAt: null,
        postedAt: null,
        postingError: null,
        createdAt: "2026-03-27T10:00:00.000Z",
        updatedAt: "2026-03-27T10:00:00.000Z",
        version: 1,
        postingOperationId: null,
      },
      links: [],
      parent: null,
      children: [],
      dependsOn: [],
      compensates: [],
      documentOperations: [],
      ledgerOperations: [],
    });
    getRequisiteById
      .mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000111",
        ownerType: "organization",
        ownerId: "org-1",
        providerId: "provider-1",
        currencyId: "currency-usd",
        kind: "bank",
        label: "Multihansa USD",
        description: "",
        beneficiaryName: "",
        institutionName: "",
        institutionCountry: "",
        accountNo: "",
        corrAccount: "",
        iban: "",
        bic: "",
        swift: "",
        bankAddress: "",
        network: "",
        assetCode: "",
        address: "",
        memoTag: "",
        accountRef: "",
        subaccountRef: "",
        contact: "",
        notes: "",
        isDefault: true,
        createdAt: "",
        updatedAt: "",
      })
      .mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000112",
        ownerType: "organization",
        ownerId: "org-1",
        providerId: "provider-1",
        currencyId: "currency-eur",
        kind: "bank",
        label: "Multihansa EUR",
        description: "",
        beneficiaryName: "",
        institutionName: "",
        institutionCountry: "",
        accountNo: "",
        corrAccount: "",
        iban: "",
        bic: "",
        swift: "",
        bankAddress: "",
        network: "",
        assetCode: "",
        address: "",
        memoTag: "",
        accountRef: "",
        subaccountRef: "",
        contact: "",
        notes: "",
        isDefault: true,
        createdAt: "",
        updatedAt: "",
      });
    getRateSources.mockResolvedValue([
      { id: "source-1", isExpired: false },
      { id: "source-2", isExpired: true },
    ]);
  });

  it("renders treasury operations as the front door for payout and collection flows", async () => {
    const { default: TreasuryOperationsPage } = await import(
      "@/app/(shell)/treasury/operations/page"
    );

    const markup = renderToStaticMarkup(await TreasuryOperationsPage());

    expect(markup).toContain("Операции казначейства");
    expect(markup).toContain("Новая операция");
    expect(markup).toContain("/treasury/operations/create");
    expect(markup).not.toContain("Казначейский FX");
    expect(markup).toContain("operations-table");
    expect(listTreasuryAccounts).toHaveBeenCalled();
    expect(listTreasuryOperations).toHaveBeenCalledWith({ limit: 100 });
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders treasury operation create page as the non-fx treasury entry", async () => {
    const { default: TreasuryOperationCreatePage } = await import(
      "@/app/(shell)/treasury/operations/create/page"
    );

    const markup = renderToStaticMarkup(await TreasuryOperationCreatePage());

    expect(markup).toContain("Новая операция казначейства");
    expect(markup).toContain("Создать");
    expect(markup).toContain("create-operation-form");
    expect(listTreasuryAccounts).toHaveBeenCalled();
    expect(getOrganizations).toHaveBeenCalledWith({ page: 1, perPage: 200 });
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders treasury positions as a settlement workspace", async () => {
    const { default: TreasuryPositionsPage } = await import(
      "@/app/(shell)/treasury/positions/page"
    );

    const markup = renderToStaticMarkup(await TreasuryPositionsPage());

    expect(markup).toContain("Позиции казначейства");
    expect(markup).toContain("positions-table");
    expect(listTreasuryPositions).toHaveBeenCalled();
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders treasury exceptions with execution matching context", async () => {
    const { default: TreasuryUnmatchedPage } = await import(
      "@/app/(shell)/treasury/unmatched/page"
    );

    const markup = renderToStaticMarkup(await TreasuryUnmatchedPage());

    expect(markup).toContain("Исключения исполнения");
    expect(markup).toContain("unmatched-table");
    expect(listExecutionInstructions).toHaveBeenCalledWith({ limit: 200 });
    expect(listTreasuryOperations).toHaveBeenCalledWith({ limit: 200 });
    expect(getTreasuryReferenceData).toHaveBeenCalled();
  });

  it("renders treasury quotes with a treasury-owned FX launch action", async () => {
    const { default: TreasuryQuotesPage } = await import(
      "@/app/(shell)/treasury/quotes/page"
    );

    const markup = renderToStaticMarkup(
      await TreasuryQuotesPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(markup).toContain("Котировки");
    expect(markup).toContain("Новый FX");
    expect(markup).toContain("/treasury/quotes/create");
    expect(markup).toContain("quotes-table");
  });

  it("renders treasury-owned FX create page outside the documents workspace", async () => {
    const { default: TreasuryFxCreatePage } = await import(
      "@/app/(shell)/treasury/quotes/create/page"
    );

    const markup = renderToStaticMarkup(await TreasuryFxCreatePage());

    expect(markup).toContain("Казначейский FX");
    expect(markup).toContain("treasury-fx-create-form");
  });

  it("renders treasury quote details inside the treasury workspace", async () => {
    const { default: TreasuryQuoteDetailPage } = await import(
      "@/app/(shell)/treasury/quotes/[quoteRef]/page"
    );

    const markup = renderToStaticMarkup(
      await TreasuryQuoteDetailPage({
        params: Promise.resolve({ quoteRef: "quote-ref-1" }),
      }),
    );

    expect(markup).toContain("USD / EUR");
    expect(markup).toContain("Новый FX");
    expect(markup).toContain("quote-detail");
    expect(getFxQuoteDetails).toHaveBeenCalledWith("quote-ref-1");
  });
});
