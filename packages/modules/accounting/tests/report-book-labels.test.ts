import { describe, expect, it, vi } from "vitest";

import { createListOperationDetailsWithLabelsQuery } from "../src/reports/application/queries/list-operation-details-with-labels";

describe("accounting report book labels", () => {
  it("uses resolved book labels for operation details postings", async () => {
    const listBookNamesById = vi.fn(async () =>
      new Map([["book-1", "Organization Bedrock default book"]]),
    );
    const listOperationDetails = vi.fn(async () =>
      new Map([
        [
          "op-1",
          {
            operation: {
              id: "op-1",
              sourceType: "documents/invoice/post",
              sourceId: "doc-1",
              operationCode: "COMMERCIAL_INVOICE_DIRECT",
              operationVersion: 1,
              postingDate: new Date("2026-03-17T11:00:00.000Z"),
              status: "posted" as const,
              error: null,
              postedAt: new Date("2026-03-17T11:00:01.000Z"),
              outboxAttempts: 1,
              lastOutboxErrorAt: null,
              createdAt: new Date("2026-03-17T11:00:00.000Z"),
              postingCount: 1,
              bookIds: ["book-1"],
              currencies: ["CNY"],
            },
            postings: [
              {
                id: "posting-1",
                lineNo: 1,
                bookId: "book-1",
                bookName:
                  "Organization 00000000-0000-4000-8000-000000000310 default book",
                debitInstanceId: "debit-1",
                debitAccountNo: "2140",
                debitDimensions: {},
                creditInstanceId: "credit-1",
                creditAccountNo: "2130",
                creditDimensions: {},
                postingCode: "TC.2005",
                currency: "CNY",
                amountMinor: 870_098n,
                memo: null,
                context: null,
                createdAt: new Date("2026-03-17T11:00:00.000Z"),
              },
            ],
            tbPlans: [],
          },
        ],
      ]),
    );
    const query = createListOperationDetailsWithLabelsQuery({
      ledgerReadPort: {
        listOperationDetails,
      },
      listBookNamesById,
      listCurrencyPrecisionsByCode: vi.fn(async () => new Map([["CNY", 2]])),
      resolveDimensionLabelsFromRecords: vi.fn(async () => ({})),
    });

    const result = await query(["op-1"]);

    expect(result.get("op-1")?.postings[0]?.bookName).toBe(
      "Organization Bedrock default book",
    );
    expect(listBookNamesById).toHaveBeenCalledWith(["book-1"]);
  });
});
