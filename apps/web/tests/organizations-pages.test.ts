import { beforeEach, describe, expect, it, vi } from "vitest";

const parseSearchParams = vi.fn();
const getOrganizations = vi.fn();

vi.mock("@/features/entities/organizations/lib/validations", () => ({
  searchParamsCache: {
    parse: parseSearchParams,
  },
}));

vi.mock("@/features/entities/organizations/lib/queries", () => ({
  getOrganizations,
  getOrganizationById: vi.fn(),
}));

vi.mock("@/components/entities/entity-list-page-shell", () => ({
  EntityListPageShell: ({ children }: { children?: unknown }) =>
    children ?? null,
}));

vi.mock("@/features/entities/organizations/components/table", () => ({
  OrganizationsTable: () => null,
}));

describe("organization pages", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

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

  it("passes parsed filters to the organizations page query", async () => {
    const { default: OrganizationsPage } =
      await import("@/app/(shell)/entities/organizations/page");

    const searchParams = Promise.resolve({
      shortName: "Bedrock",
      kind: ["legal_entity"],
    });

    await OrganizationsPage({ searchParams }).catch(() => null);

    expect(parseSearchParams).toHaveBeenCalledWith(searchParams);
    expect(getOrganizations).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      shortName: "Bedrock",
      kind: ["legal_entity"],
    });
  });

  it("passes parsed filters to the treasury organizations page query", async () => {
    const { default: TreasuryOrganizationsPage } =
      await import("@/app/(shell)/treasury/organizations/page");

    const searchParams = Promise.resolve({
      country: ["AE"],
      sort: "updatedAt.desc",
    });

    await TreasuryOrganizationsPage({ searchParams }).catch(() => null);

    expect(parseSearchParams).toHaveBeenCalledWith(searchParams);
    expect(getOrganizations).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      country: ["AE"],
      sort: "updatedAt.desc",
    });
  });
});
