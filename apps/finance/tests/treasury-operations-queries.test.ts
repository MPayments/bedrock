import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerApiClient = vi.fn();
const readPaginatedList = vi.fn();
const stepsGet = vi.fn();
const quoteExecutionsGet = vi.fn();

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
          "quote-executions": {
            $get: quoteExecutionsGet,
          },
          steps: {
            $get: stepsGet,
          },
        },
      },
    });
    readPaginatedList.mockImplementation(async ({ request }) => {
      await request();
      return {
        data: {
          data: [],
          limit: 100,
          offset: 0,
          total: 0,
        },
      };
    });
  });

  it("sends pagination defaults when search is empty", async () => {
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    await getTreasuryOperations({});

    expect(stepsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(quoteExecutionsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
  }, 15_000);

  it("fetches payment step pages beyond the first page before slicing", async () => {
    stepsGet.mockImplementation(async ({ query }) => ({
      json: async () => ({
        kind: "steps",
        offset: Number(query.offset),
      }),
      ok: true,
      status: 200,
    }));
    quoteExecutionsGet.mockImplementation(async ({ query }) => ({
      json: async () => ({
        kind: "quoteExecutions",
        offset: Number(query.offset),
      }),
      ok: true,
      status: 200,
    }));
    readPaginatedList.mockImplementation(async ({ request }) => {
      const response = await request();
      const marker = await response.json();
      if (marker.kind === "steps" && marker.offset === 0) {
        return {
          data: {
            data: Array.from({ length: 100 }, (_, index) => ({
              createdAt: "2026-04-02T00:00:00.000Z",
              id: `step-${index}`,
            })),
            limit: 100,
            offset: 0,
            total: 101,
          },
        };
      }
      if (marker.kind === "steps") {
        return {
          data: {
            data: [
              {
                createdAt: "2026-04-01T00:00:00.000Z",
                id: "step-late",
              },
            ],
            limit: 100,
            offset: 100,
            total: 101,
          },
        };
      }
      return {
        data: {
          data: [],
          limit: 100,
          offset: marker.offset,
          total: 0,
        },
      };
    });
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    const result = await getTreasuryOperations({ page: 11, perPage: 10 });

    expect(stepsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "100",
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(result.total).toBe(101);
    expect(result.data).toEqual([
      expect.objectContaining({
        id: "step-late",
        runtimeType: "payment_step",
      }),
    ]);
  });

  it("forwards purpose/state/dealId filters when provided", async () => {
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    await getTreasuryOperations({
      page: 2,
      perPage: 25,
      purpose: "standalone_payment",
      state: ["pending", "processing"],
      dealId: "00000000-0000-4000-8000-000000000010",
    });

    expect(stepsGet).toHaveBeenCalledWith(
      {
        query: {
          dealId: "00000000-0000-4000-8000-000000000010",
          limit: "100",
          offset: "0",
          purpose: "standalone_payment",
          state: ["pending", "processing"],
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(quoteExecutionsGet).toHaveBeenCalledWith(
      {
        query: {
          dealId: "00000000-0000-4000-8000-000000000010",
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
  });

  it("filters out unknown purpose / state enum values", async () => {
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    await getTreasuryOperations({
      purpose: "bogus",
      state: ["pending", "not_a_real_state"],
    });

    expect(stepsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
          state: ["pending"],
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(quoteExecutionsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
          state: "pending",
        },
      },
      { init: { cache: "no-store" } },
    );
  });

  it("forwards createdAt range as createdFrom/createdTo ISO bounds", async () => {
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    await getTreasuryOperations({
      createdAt: ["2026-04-01", "2026-04-24"],
    });

    expect(stepsGet).toHaveBeenCalledWith(
      {
        query: {
          createdFrom: "2026-04-01T00:00:00.000Z",
          createdTo: "2026-04-24T00:00:00.000Z",
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(quoteExecutionsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
  });

  it("drops malformed createdAt entries", async () => {
    const { getTreasuryOperations } = await import(
      "@/features/treasury/operations/lib/queries"
    );

    await getTreasuryOperations({
      createdAt: ["", "not-a-date"],
    });

    expect(stepsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
    expect(quoteExecutionsGet).toHaveBeenCalledWith(
      {
        query: {
          limit: "100",
          offset: "0",
        },
      },
      { init: { cache: "no-store" } },
    );
  });
});
