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
const getFinanceDealWorkspaceById = vi.fn();
const getAgreementContextById = vi.fn();
const DocumentCreateTypedFormClient = vi.fn(() => null);
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
  getFinanceDealWorkspaceById,
}));

vi.mock("@/features/agreements/lib/queries", () => ({
  getAgreementContextById,
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
    getFinanceDealWorkspaceById.mockResolvedValue(null);
    getAgreementContextById.mockResolvedValue(null);
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
  });

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
  });

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
    getFinanceDealWorkspaceById.mockResolvedValue({
      formalDocumentRequirements: [],
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
        counterpartyId: "00000000-0000-4000-8000-000000000222",
        customerId: "00000000-0000-4000-8000-000000000111",
        organizationId: "00000000-0000-4000-8000-000000000333",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000555",
      },
    });
  });

  it("falls back to the deal documents tab and prefills closing docs from the opening invoice", async () => {
    getFinanceDealWorkspaceById.mockResolvedValue({
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
});
