import { beforeEach, describe, expect, it, vi } from "vitest";

const NOT_FOUND = new Error("NOT_FOUND");

const notFound = vi.fn(() => {
  throw NOT_FOUND;
});

const getServerSessionSnapshot = vi.fn();
const parseSearchParams = vi.fn();
const getDocuments = vi.fn();
const getDocumentFormOptions = vi.fn();
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

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("@/features/documents/components/documents-table", () => ({
  DocumentsTable: () => null,
}));

vi.mock("@/features/documents/components/document-create-typed-form-client", () => ({
  DocumentCreateTypedFormClient: () => null,
}));

describe("document pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getServerSessionSnapshot.mockResolvedValue({ role: "user" });
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

  it("returns notFound for admin-only create pages when role is user", async () => {
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

  it("returns notFound for treasury-owned document create pages in documents workspace", async () => {
    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/create/[docType]/page"
    );

    await expect(
      CreatePage({
        params: Promise.resolve({
          docType: "fx_execute",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("returns notFound for treasury-owned docType filters in documents family pages", async () => {
    const { default: FamilyPage } = await import(
      "@/app/(shell)/documents/[family]/page"
    );

    await expect(
      FamilyPage({
        params: Promise.resolve({
          family: "ifrs",
        }),
        searchParams: Promise.resolve({ docType: "fx_execute" }),
      }),
    ).rejects.toBe(NOT_FOUND);
  });
});
