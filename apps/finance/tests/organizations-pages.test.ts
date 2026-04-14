import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const REDIRECT = new Error("REDIRECT");

const redirect = vi.fn(() => {
  throw REDIRECT;
});

const parseSearchParams = vi.fn();
const getOrganizations = vi.fn();

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("next/link", () => ({
  default: () => null,
}));

vi.mock("lucide-react", () => ({
  Building2: () => null,
  Plus: () => null,
}));

vi.mock("@bedrock/sdk-ui/components/button", () => ({
  Button: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("@bedrock/sdk-tables-ui/components/data-table-skeleton", () => ({
  DataTableSkeleton: () => null,
}));

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("@/features/entities/organizations/components/table", () => ({
  OrganizationsTable: () => null,
}));

vi.mock("@/features/entities/organizations/lib/validations", () => ({
  searchParamsCache: {
    parse: parseSearchParams,
  },
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizations,
  getOrganizationById: vi.fn(),
}));

describe("organization pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.assign(globalThis, { React });

    parseSearchParams.mockImplementation(async (input) => ({
      page: 1,
      perPage: 20,
      ...(await input),
    }));
    getOrganizations.mockResolvedValue({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  it("redirects the legacy organizations list route to treasury and preserves filters", async () => {
    const { default: OrganizationsPage } = await import(
      "@/app/(shell)/entities/organizations/page"
    );

    const searchParams = Promise.resolve({
      shortName: "Bedrock",
      kind: ["legal_entity"],
    });

    await expect(OrganizationsPage({ searchParams })).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith(
      "/treasury/organizations?shortName=Bedrock&kind=legal_entity",
    );
  });

  it("redirects the legacy organizations create route to treasury", async () => {
    const { default: CreateOrganizationPage } = await import(
      "@/app/(shell)/entities/organizations/create/page"
    );

    expect(() => CreateOrganizationPage()).toThrow(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/treasury/organizations/create");
  });

  it("passes parsed filters to the treasury organizations page query", async () => {
    const { default: TreasuryOrganizationsPage } = await import(
      "@/app/(shell)/treasury/organizations/page"
    );

    const searchParams = Promise.resolve({
      country: ["AE"],
      sort: "updatedAt.desc",
    });

    await TreasuryOrganizationsPage({ searchParams });

    expect(parseSearchParams).toHaveBeenCalledWith(searchParams);
    expect(getOrganizations).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      country: ["AE"],
      sort: "updatedAt.desc",
    });
  });
});
