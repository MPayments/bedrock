import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerApiClient = vi.fn();
const readPaginatedList = vi.fn();
const organizationsGet = vi.fn();

vi.mock("@/lib/api/server-client", () => ({
  getServerApiClient,
}));

vi.mock("@/lib/api/query", () => ({
  readEntityById: vi.fn(),
  readPaginatedList,
}));

describe("organizations queries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getServerApiClient.mockResolvedValue({
      v1: {
        organizations: {
          $get: organizationsGet,
        },
      },
    });
    readPaginatedList.mockImplementation(async ({ request }) => {
      await request();
      return {
        data: {
          data: [],
          total: 0,
          limit: 25,
          offset: 25,
        },
      };
    });
  });

  it("serializes organization filters via the list query contract", async () => {
    const { getOrganizations } =
      await import("@/features/entities/organizations/lib/queries");

    await getOrganizations({
      page: 2,
      perPage: 25,
      shortName: "Bedrock",
      country: ["AE"],
      kind: ["legal_entity"],
      sort: [{ id: "updatedAt", desc: true }],
    });

    expect(organizationsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: 25,
          offset: 25,
          shortName: "Bedrock",
          country: ["AE"],
          kind: ["legal_entity"],
          sortBy: "updatedAt",
          sortOrder: "desc",
        },
      },
      { init: { cache: "no-store" } },
    );
  }, 15_000);
});
