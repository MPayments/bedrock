import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerApiClient = vi.fn();
const readPaginatedList = vi.fn();
const operationsGet = vi.fn();

vi.mock("@/lib/api/server-client", () => ({
  getServerApiClient,
}));

vi.mock("@/lib/api/query", () => ({
  readEntityById: vi.fn(),
  readPaginatedList,
}));

describe("treasury operations queries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getServerApiClient.mockResolvedValue({
      v1: {
        treasury: {
          operations: {
            $get: operationsGet,
          },
        },
      },
    });
    readPaginatedList.mockImplementation(async ({ request }) => {
      await request();
      return {
        data: {
          data: [],
          limit: 20,
          offset: 0,
          total: 0,
          viewCounts: {
            all: 0,
            exceptions: 0,
            fx: 0,
            incoming: 0,
            intercompany: 0,
            intracompany: 0,
            outgoing: 0,
          },
        },
      };
    });
  });

  it("loads operations without forcing a saved view on default list requests", async () => {
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    const result = await getTreasuryOperations({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
    });

    expect(operationsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: 20,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(result.viewCounts.all).toBe(0);
  }, 15_000);
});
