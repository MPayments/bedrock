import { beforeEach, describe, expect, it, vi } from "vitest";

const headers = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/headers", () => ({
  headers,
}));

describe("treasury deals queries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    headers.mockResolvedValue(
      new Headers({
        cookie: "session=token",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  it("serializes filters and applies local sort with pagination", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        counts: {
          execution: 2,
          failed_instruction: 0,
          funding: 0,
        },
        filters: {
          applicant: "ООО",
          queue: "execution",
        },
        items: [
          {
            applicantName: "ООО Бета",
            blockingReasons: [],
            createdAt: "2026-04-03T00:00:00.000Z",
            dealId: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
            documentSummary: {
              attachmentCount: 1,
              formalDocumentCount: 2,
            },
            executionSummary: {
              blockedLegCount: 0,
              doneLegCount: 1,
              totalLegCount: 2,
            },
            internalEntityName: "Орг Б",
            nextAction: "Подготовить платеж",
            profitabilitySnapshot: null,
            queue: "execution",
            queueReason: "Сделка ожидает исполнения",
            quoteSummary: null,
            status: "awaiting_payment",
            type: "payment",
          },
          {
            applicantName: "ООО Альфа",
            blockingReasons: [],
            createdAt: "2026-04-02T00:00:00.000Z",
            dealId: "b21972b4-aee0-45fb-86f8-b4175b42b39c",
            documentSummary: {
              attachmentCount: 0,
              formalDocumentCount: 1,
            },
            executionSummary: {
              blockedLegCount: 0,
              doneLegCount: 0,
              totalLegCount: 1,
            },
            internalEntityName: "Орг А",
            nextAction: "Проверить документы",
            profitabilitySnapshot: null,
            queue: "execution",
            queueReason: "Сделка ожидает исполнения",
            quoteSummary: null,
            status: "submitted",
            type: "currency_exchange",
          },
        ],
      }),
    });

    const { getFinanceDeals } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    const result = await getFinanceDeals({
      applicant: "ООО",
      page: 2,
      perPage: 1,
      queue: "execution",
      sort: [{ id: "applicantName", desc: false }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/deals/finance/queues?applicant=%D0%9E%D0%9E%D0%9E&queue=execution",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          applicantName: "ООО Бета",
          dealId: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
        }),
      ],
      total: 2,
      limit: 1,
      offset: 1,
    });
  });

  it("returns null for an invalid deal id without hitting the API", async () => {
    const { getFinanceDealWorkspaceById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    await expect(getFinanceDealWorkspaceById("not-a-uuid")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

