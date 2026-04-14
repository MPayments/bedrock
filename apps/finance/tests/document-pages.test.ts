import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOT_FOUND = new Error("NOT_FOUND");

const notFound = vi.fn(() => {
  throw NOT_FOUND;
});

const getServerSessionSnapshot = vi.fn();
const parseSearchParams = vi.fn();
const getDocuments = vi.fn();
const getDocumentFormOptions = vi.fn();
const getFinanceDealWorkbenchById = vi.fn();
const getAgreementContextById = vi.fn();
const getOrganizationRequisitesForOrganization = vi.fn();
const DocumentCreateTypedFormClient = vi.fn(() => null);
const DocumentDetailsView = vi.fn(() => null);
const createEmptyDocumentFormOptions = vi.fn(() => ({
  counterparties: [],
  customers: [],
  organizations: [],
  currencies: [],
}));

vi.mock("next/navigation", () => ({
  notFound,
}));

vi.mock("@/lib/auth/session", () => ({
  getServerSessionSnapshot,
}));

vi.mock("@/features/operations/documents/lib/validations", () => ({
  searchParamsCache: {
    parse: parseSearchParams,
  },
}));

vi.mock("@/features/operations/documents/lib/queries", () => ({
  getDocuments,
  getDocumentDetails: vi.fn(),
}));

vi.mock("@/features/documents/lib/form-options", () => ({
  createEmptyDocumentFormOptions,
  getDocumentFormOptions,
}));

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealWorkbenchById,
}));

vi.mock("@/features/agreements/lib/queries", () => ({
  getAgreementContextById,
}));

vi.mock("@/features/entities/organization-requisites/lib/queries", () => ({
  getOrganizationRequisitesForOrganization,
}));

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("@/features/documents/components/documents-table", () => ({
  DocumentsTable: () => null,
}));

vi.mock("@/features/documents/components/document-create-typed-form-client", () => ({
  DocumentCreateTypedFormClient,
}));

vi.mock("@/features/documents/components/document-details-view", () => ({
  DocumentDetailsView,
}));

describe("document pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    getServerSessionSnapshot.mockResolvedValue({ role: "finance" });
    parseSearchParams.mockImplementation(async (input) => ({
      page: 1,
      perPage: 20,
      ...(await input),
    }));
    getDocuments.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    getDocumentFormOptions.mockResolvedValue({
      counterparties: [],
      customers: [],
      organizations: [],
      currencies: [],
    });
    getFinanceDealWorkbenchById.mockResolvedValue(null);
    getAgreementContextById.mockResolvedValue(null);
    getOrganizationRequisitesForOrganization.mockResolvedValue([]);
  });

  it("returns notFound for removed /documents/create family route", async () => {
    const { default: FamilyPage } = await import(
      "@/app/(shell)/documents/[family]/page"
    );

    await expect(
      FamilyPage({
        params: Promise.resolve({ family: "create" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
  }, 15000);

  it("returns notFound for removed /documents/create/[docType] route shape", async () => {
    const { default: FamilyPage } = await import(
      "@/app/(shell)/documents/[family]/page"
    );

    await expect(
      FamilyPage({
        params: Promise.resolve({
          family: "transfers",
        }),
        searchParams: Promise.resolve({ docType: "legacy_doc_type" }),
      }),
    ).rejects.toBe(NOT_FOUND);
  }, 15000);

  it("returns notFound for family filter mismatches", async () => {
    const { default: FamilyPage } = await import(
      "@/app/(shell)/documents/[family]/page"
    );

    await expect(
      FamilyPage({
        params: Promise.resolve({
          family: "transfers",
        }),
        searchParams: Promise.resolve({ docType: "capital_funding" }),
      }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("returns notFound for admin-only create pages when role is finance", async () => {
    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/create/[docType]/page"
    );

    await expect(
      CreatePage({
        params: Promise.resolve({
          docType: "period_reopen",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("passes invoice prefills and validated success href for deal-scoped create pages", async () => {
    getDocumentFormOptions.mockResolvedValue({
      counterparties: [],
      customers: [],
      organizations: [],
      currencies: [
        {
          code: "RUB",
          id: "00000000-0000-4000-8000-000000000666",
          label: "Российский рубль",
        },
      ],
    });
    getFinanceDealWorkbenchById.mockResolvedValue({
      calculationHistory: [
        {
          baseCurrencyId: "00000000-0000-4000-8000-000000000667",
          calculationCurrencyId: "00000000-0000-4000-8000-000000000666",
          calculationId: "00000000-0000-4000-8000-000000000668",
          calculationTimestamp: "2026-03-03T10:00:00.000Z",
          createdAt: "2026-03-03T10:00:00.000Z",
          totalFeeAmountMinor: "1500",
          fxQuoteId: "00000000-0000-4000-8000-000000000669",
          originalAmountMinor: "100000",
          rateDen: "1",
          rateNum: "1",
          sourceQuoteId: "00000000-0000-4000-8000-000000000669",
          totalAmountMinor: "101500",
          totalInBaseMinor: "100000",
          totalWithExpensesInBaseMinor: "101500",
        },
      ],
      formalDocumentRequirements: [],
      summary: {
        calculationId: "00000000-0000-4000-8000-000000000668",
      },
      workflow: {
        intake: {
          common: {
            applicantCounterpartyId: "00000000-0000-4000-8000-000000000222",
          },
        },
        participants: [
          {
            counterpartyId: null,
            customerId: "00000000-0000-4000-8000-000000000111",
            organizationId: null,
            role: "customer",
          },
          {
            counterpartyId: "00000000-0000-4000-8000-000000000222",
            customerId: null,
            organizationId: null,
            role: "applicant",
          },
          {
            counterpartyId: null,
            customerId: null,
            organizationId: "00000000-0000-4000-8000-000000000333",
            role: "internal_entity",
          },
        ],
        summary: {
          agreementId: "00000000-0000-4000-8000-000000000444",
        },
      },
    });
    getAgreementContextById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000444",
      organizationId: "00000000-0000-4000-8000-000000000333",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000555",
    });
    getOrganizationRequisitesForOrganization.mockResolvedValue([
      {
        createdAt: "2026-03-02T10:00:00.000Z",
        currencyDisplay: "US Dollar",
        currencyId: "00000000-0000-4000-8000-000000000667",
        id: "00000000-0000-4000-8000-000000000555",
        identity: "US-ACC-1",
        isDefault: true,
        kind: "bank",
        kindDisplay: "Банк",
        label: "USD Requisite",
        ownerDisplay: "Multihansa",
        ownerId: "00000000-0000-4000-8000-000000000333",
        ownerType: "organization",
        providerDisplay: "Bank",
        providerId: "00000000-0000-4000-8000-000000000777",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
      {
        createdAt: "2026-03-03T10:00:00.000Z",
        currencyDisplay: "Российский рубль",
        currencyId: "00000000-0000-4000-8000-000000000666",
        id: "00000000-0000-4000-8000-000000000556",
        identity: "RU-ACC-1",
        isDefault: true,
        kind: "bank",
        kindDisplay: "Банк",
        label: "RUB Requisite",
        ownerDisplay: "Multihansa",
        ownerId: "00000000-0000-4000-8000-000000000333",
        ownerType: "organization",
        providerDisplay: "Bank",
        providerId: "00000000-0000-4000-8000-000000000778",
        updatedAt: "2026-03-03T10:00:00.000Z",
      },
    ]);

    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/create/[docType]/page"
    );

    const page = await CreatePage({
      params: Promise.resolve({
        docType: "invoice",
      }),
      searchParams: Promise.resolve({
        dealId: "00000000-0000-4000-8000-000000000999",
        returnTo: "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=documents",
      }),
    });
    renderToStaticMarkup(page);

    expect(DocumentCreateTypedFormClient).toHaveBeenCalled();

    const lastCall = DocumentCreateTypedFormClient.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    expect(lastCall).toBeDefined();
    const [props] = lastCall!;
    expect(props).toMatchObject({
      dealId: "00000000-0000-4000-8000-000000000999",
      docType: "invoice",
      successHref:
        "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=documents",
      initialPayload: {
        amount: "1015",
        counterpartyId: "00000000-0000-4000-8000-000000000222",
        currency: "RUB",
        customerId: "00000000-0000-4000-8000-000000000111",
        organizationId: "00000000-0000-4000-8000-000000000333",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000556",
      },
    });
  });

  it("leaves invoice organization requisite empty when the organization has no matching currency requisite", async () => {
    getDocumentFormOptions.mockResolvedValue({
      counterparties: [],
      customers: [],
      organizations: [],
      currencies: [
        {
          code: "RUB",
          id: "00000000-0000-4000-8000-000000000666",
          label: "Российский рубль",
        },
      ],
    });
    getFinanceDealWorkbenchById.mockResolvedValue({
      calculationHistory: [
        {
          baseCurrencyId: "00000000-0000-4000-8000-000000000667",
          calculationCurrencyId: "00000000-0000-4000-8000-000000000666",
          calculationId: "00000000-0000-4000-8000-000000000668",
          calculationTimestamp: "2026-03-03T10:00:00.000Z",
          createdAt: "2026-03-03T10:00:00.000Z",
          totalFeeAmountMinor: "1500",
          fxQuoteId: "00000000-0000-4000-8000-000000000669",
          originalAmountMinor: "100000",
          rateDen: "1",
          rateNum: "1",
          sourceQuoteId: "00000000-0000-4000-8000-000000000669",
          totalAmountMinor: "101500",
          totalInBaseMinor: "100000",
          totalWithExpensesInBaseMinor: "101500",
        },
      ],
      formalDocumentRequirements: [],
      summary: {
        calculationId: "00000000-0000-4000-8000-000000000668",
      },
      workflow: {
        intake: {
          common: {
            applicantCounterpartyId: "00000000-0000-4000-8000-000000000222",
          },
        },
        participants: [
          {
            counterpartyId: null,
            customerId: "00000000-0000-4000-8000-000000000111",
            organizationId: null,
            role: "customer",
          },
          {
            counterpartyId: "00000000-0000-4000-8000-000000000222",
            customerId: null,
            organizationId: null,
            role: "applicant",
          },
          {
            counterpartyId: null,
            customerId: null,
            organizationId: "00000000-0000-4000-8000-000000000333",
            role: "internal_entity",
          },
        ],
        summary: {
          agreementId: "00000000-0000-4000-8000-000000000444",
        },
      },
    });
    getAgreementContextById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000444",
      organizationId: "00000000-0000-4000-8000-000000000333",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000555",
    });
    getOrganizationRequisitesForOrganization.mockResolvedValue([
      {
        createdAt: "2026-03-02T10:00:00.000Z",
        currencyDisplay: "US Dollar",
        currencyId: "00000000-0000-4000-8000-000000000667",
        id: "00000000-0000-4000-8000-000000000555",
        identity: "US-ACC-1",
        isDefault: true,
        kind: "bank",
        kindDisplay: "Банк",
        label: "USD Requisite",
        ownerDisplay: "Multihansa",
        ownerId: "00000000-0000-4000-8000-000000000333",
        ownerType: "organization",
        providerDisplay: "Bank",
        providerId: "00000000-0000-4000-8000-000000000777",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
    ]);

    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/create/[docType]/page"
    );

    const page = await CreatePage({
      params: Promise.resolve({
        docType: "invoice",
      }),
      searchParams: Promise.resolve({
        dealId: "00000000-0000-4000-8000-000000000999",
      }),
    });
    renderToStaticMarkup(page);

    const lastCall = DocumentCreateTypedFormClient.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    expect(lastCall).toBeDefined();
    const [props] = lastCall!;
    expect(props).toMatchObject({
      initialPayload: {
        amount: "1015",
        counterpartyId: "00000000-0000-4000-8000-000000000222",
        currency: "RUB",
        customerId: "00000000-0000-4000-8000-000000000111",
        organizationId: "00000000-0000-4000-8000-000000000333",
      },
    });
    expect(
      (props as { initialPayload?: Record<string, unknown> }).initialPayload
        ?.organizationRequisiteId,
    ).toBeUndefined();
  });

  it("falls back to the deal documents tab and prefills closing docs from the opening invoice", async () => {
    getFinanceDealWorkbenchById.mockResolvedValue({
      calculationHistory: [],
      formalDocumentRequirements: [
        {
          activeDocumentId: "00000000-0000-4000-8000-000000000777",
          blockingReasons: [],
          createAllowed: false,
          docType: "invoice",
          openAllowed: true,
          stage: "opening",
          state: "ready",
        },
      ],
      summary: {
        calculationId: null,
      },
      workflow: {
        intake: {
          common: {
            applicantCounterpartyId: null,
          },
        },
        participants: [],
        summary: {
          agreementId: "00000000-0000-4000-8000-000000000444",
        },
      },
    });

    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/create/[docType]/page"
    );

    const page = await CreatePage({
      params: Promise.resolve({
        docType: "acceptance",
      }),
      searchParams: Promise.resolve({
        dealId: "00000000-0000-4000-8000-000000000999",
        returnTo: "https://example.com/escape",
      }),
    });
    renderToStaticMarkup(page);

    const lastCall = DocumentCreateTypedFormClient.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    expect(lastCall).toBeDefined();
    const [props] = lastCall!;
    expect(props).toMatchObject({
      dealId: "00000000-0000-4000-8000-000000000999",
      docType: "acceptance",
      successHref:
        "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=documents",
      initialPayload: {
        invoiceDocumentId: "00000000-0000-4000-8000-000000000777",
      },
    });
    expect(getAgreementContextById).not.toHaveBeenCalled();
  });

  it("passes reconciliation adjustment context through deal-scoped create pages", async () => {
    getFinanceDealWorkbenchById.mockResolvedValue({
      calculationHistory: [],
      formalDocumentRequirements: [],
      relatedResources: {
        formalDocuments: [
          {
            approvalStatus: null,
            createdAt: "2026-03-03T10:00:00.000Z",
            docType: "transfer_intra",
            id: "00000000-0000-4000-8000-000000000701",
            lifecycleStatus: "active",
            occurredAt: "2026-03-03T10:00:00.000Z",
            postingStatus: "posted",
            submissionStatus: "submitted",
          },
        ],
      },
      summary: {
        calculationId: null,
      },
      workflow: {
        intake: {
          common: {
            applicantCounterpartyId: null,
          },
        },
        participants: [],
      },
    });

    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/create/[docType]/page"
    );

    const page = await CreatePage({
      params: Promise.resolve({
        docType: "transfer_resolution",
      }),
      searchParams: Promise.resolve({
        dealId: "00000000-0000-4000-8000-000000000999",
        reconciliationExceptionId:
          "00000000-0000-4000-8000-000000000998",
        returnTo:
          "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=execution",
      }),
    });
    renderToStaticMarkup(page);

    const lastCall = DocumentCreateTypedFormClient.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    expect(lastCall).toBeDefined();

    const [props] = lastCall!;
    expect(props).toMatchObject({
      dealId: "00000000-0000-4000-8000-000000000999",
      docType: "transfer_resolution",
      reconciliationAdjustmentExceptionId:
        "00000000-0000-4000-8000-000000000998",
      successHref:
        "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=execution",
      initialPayload: {
        eventIdempotencyKey:
          "reconciliation:00000000-0000-4000-8000-000000000998",
        pendingIndex: 0,
        transferDocumentId: "00000000-0000-4000-8000-000000000701",
      },
    });
  });

  it("passes reconciliation adjustment context to document details views", async () => {
    const getDocumentDetails = vi.fn().mockResolvedValue({
      children: [],
      compensates: [],
      computed: null,
      dependsOn: [],
      document: {
        allowedActions: [],
        amount: null,
        approvalStatus: "not_required",
        approvedAt: null,
        approvedBy: null,
        cancelledAt: null,
        cancelledBy: null,
        counterpartyId: null,
        createIdempotencyKey: null,
        createdAt: "2026-03-03T10:00:00.000Z",
        createdBy: "user-1",
        currency: null,
        customerId: null,
        dealId: "00000000-0000-4000-8000-000000000999",
        docNo: "TRR-1",
        docType: "transfer_resolution",
        id: "00000000-0000-4000-8000-000000000777",
        lifecycleStatus: "active",
        memo: null,
        occurredAt: "2026-03-03T10:00:00.000Z",
        organizationRequisiteId: null,
        payload: {},
        payloadVersion: 1,
        postingError: null,
        postingOperationId: null,
        postingStartedAt: null,
        postingStatus: "unposted",
        postedAt: null,
        rejectedAt: null,
        rejectedBy: null,
        searchText: "TRR-1",
        submissionStatus: "draft",
        submittedAt: null,
        submittedBy: null,
        title: "Transfer resolution",
        updatedAt: "2026-03-03T10:00:00.000Z",
        version: 1,
      },
      documentOperations: [],
      extra: null,
      ledgerOperations: [],
      links: [],
      parent: null,
    });

    vi.doMock("@/features/operations/documents/lib/queries", () => ({
      getDocuments,
      getDocumentDetails,
    }));

    const { default: DetailsPage } = await import(
      "@/app/(shell)/documents/[family]/[docType]/[id]/page"
    );

    const page = await DetailsPage({
      params: Promise.resolve({
        family: "transfers",
        docType: "transfer_resolution",
        id: "00000000-0000-4000-8000-000000000777",
      }),
      searchParams: Promise.resolve({
        reconciliationExceptionId:
          "00000000-0000-4000-8000-000000000998",
        returnTo:
          "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=execution",
      }),
    });
    renderToStaticMarkup(page);

    const lastCall = DocumentDetailsView.mock.calls.at(-1) as
      | [unknown]
      | undefined;
    expect(lastCall).toBeDefined();

    const [props] = lastCall!;
    expect(props).toMatchObject({
      dealId: "00000000-0000-4000-8000-000000000999",
      reconciliationAdjustmentExceptionId:
        "00000000-0000-4000-8000-000000000998",
      returnToHref:
        "/treasury/deals/00000000-0000-4000-8000-000000000999?tab=execution",
    });
  });
});
