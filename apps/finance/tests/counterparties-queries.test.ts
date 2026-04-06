import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerApiClient = vi.fn();
const readPaginatedList = vi.fn();
const counterpartiesGet = vi.fn();

vi.mock("@/lib/api/server-client", () => ({
  getServerApiClient,
}));

vi.mock("@/lib/api/query", () => ({
  readEntityById: vi.fn(),
  readOptionsList: vi.fn(),
  readPaginatedList,
}));

describe("counterparties queries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getServerApiClient.mockResolvedValue({
      v1: {
        counterparties: {
          $get: counterpartiesGet,
        },
      },
    });
    readPaginatedList.mockImplementation(async ({ request, schema }) => {
      await request();

      return {
        data: schema.parse({
          data: [
            {
              id: "00000000-0000-4000-8000-000000000204",
              externalId: null,
              customerId: "00000000-0000-4000-8000-000000000201",
              relationshipKind: "customer_owned",
              shortName: "Test Counterparty",
              fullName: "Test Counterparty LLC",
              description: null,
              country: "AE",
              kind: "legal_entity",
              groupIds: [],
              createdAt: "2026-04-06T12:00:00.000Z",
              updatedAt: "2026-04-06T12:00:00.000Z",
            },
          ],
          total: 1,
          limit: 25,
          offset: 0,
        }),
      };
    });
  });

  it("parses projection-only counterparty list items without legalEntity", async () => {
    const { getCounterparties } = await import(
      "@/features/entities/counterparties/lib/queries"
    );

    const payload = await getCounterparties({
      page: 1,
      perPage: 25,
    });

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.shortName).toBe("Test Counterparty");
    expect("legalEntity" in payload.data[0]!).toBe(false);
  });
});
