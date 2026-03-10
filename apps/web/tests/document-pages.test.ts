import { beforeEach, describe, expect, it, vi } from "vitest";

const NOT_FOUND = new Error("NOT_FOUND");

const notFound = vi.fn(() => {
  throw NOT_FOUND;
});

const getServerSessionSnapshot = vi.fn();
const parseSearchParams = vi.fn();
const getDocuments = vi.fn();
const getDocumentFormOptions = vi.fn();

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
    parseSearchParams.mockResolvedValue({ page: 1, perPage: 20 });
    getDocuments.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    getDocumentFormOptions.mockResolvedValue({
      counterparties: [],
      organizations: [],
      currencies: [],
    });
  });

  it("returns notFound for removed /documents/create family route", async () => {
    const { default: FamilyPage } = await import(
      "@/app/(shell)/documents/[family]/page"
    );

    await expect(
      FamilyPage({ params: Promise.resolve({ family: "create" }) }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("returns notFound for removed /documents/create/[docType] route shape", async () => {
    const { default: TypePage } = await import(
      "@/app/(shell)/documents/[family]/[docType]/page"
    );

    await expect(
      TypePage({
        params: Promise.resolve({
          family: "create",
          docType: "transfer_intra",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("returns notFound for family/docType mismatches", async () => {
    const { default: TypePage } = await import(
      "@/app/(shell)/documents/[family]/[docType]/page"
    );

    await expect(
      TypePage({
        params: Promise.resolve({
          family: "transfers",
          docType: "capital_funding",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("returns notFound for admin-only create pages when role is user", async () => {
    const { default: CreatePage } = await import(
      "@/app/(shell)/documents/[family]/[docType]/create/page"
    );

    await expect(
      CreatePage({
        params: Promise.resolve({
          family: "ifrs",
          docType: "period_reopen",
        }),
      }),
    ).rejects.toBe(NOT_FOUND);
  });
});
