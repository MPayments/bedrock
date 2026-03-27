import { describe, expect, it, vi } from "vitest";

const {
  fakeDbExecute,
  listCurrencyPrecisionsByCode,
  listOperationDetails,
  listOrganizationShortNamesById,
} = vi.hoisted(() => ({
  fakeDbExecute: vi.fn(async () => ({ rows: [] })),
  listCurrencyPrecisionsByCode: vi.fn(
    async () => new Map([["USD", 2]]),
  ),
  listOperationDetails: vi.fn(async () =>
    new Map([
      [
        "11111111-1111-4111-8111-111111111111",
        {
          operation: {
            id: "11111111-1111-4111-8111-111111111111",
            sourceType: "documents/incoming_invoice/post",
            sourceId: "doc-1",
            operationCode: "COMMERCIAL_INCOMING_INVOICE_OPEN",
            operationVersion: 1,
            postingDate: new Date("2026-03-26T10:00:00.000Z"),
            status: "pending" as const,
            error: null,
            postedAt: null,
            outboxAttempts: 0,
            lastOutboxErrorAt: null,
            createdAt: new Date("2026-03-26T10:00:00.000Z"),
            postingCount: 1,
            bookIds: ["book-1"],
            currencies: ["USD"],
          },
          postings: [
            {
              id: "posting-1",
              lineNo: 1,
              bookId: "book-1",
              bookName:
                "Organization 00000000-0000-4000-8000-000000000310 default book",
              debitInstanceId: "debit-1",
              debitAccountNo: "5130",
              debitDimensions: {},
              creditInstanceId: "credit-1",
              creditAccountNo: "2150",
              creditDimensions: {},
              postingCode: "CM.1001",
              currency: "USD",
              amountMinor: 32000000n,
              memo: null,
              context: null,
              createdAt: new Date("2026-03-26T10:00:00.000Z"),
            },
          ],
          tbPlans: [],
        },
      ],
    ]),
  ),
  listOrganizationShortNamesById: vi.fn(
    async () =>
      new Map([
        ["00000000-0000-4000-8000-000000000310", "BEDROCK"],
      ]),
  ),
}));

vi.mock("@bedrock/currencies/queries", () => ({
  createCurrenciesQueries: vi.fn(() => ({
    listPrecisionsByCode: listCurrencyPrecisionsByCode,
  })),
}));

vi.mock("../../src/composition/ledger-module", () => {
  class FakeBooksQueries {
    constructor(
      private readonly db: { execute: typeof fakeDbExecute },
    ) {}

    async listById(ids: string[]) {
      await this.db.execute({ kind: "list-books", ids });

      return [
        {
          id: "book-1",
          name: "Organization 00000000-0000-4000-8000-000000000310 default book",
          ownerId: "00000000-0000-4000-8000-000000000310",
        },
      ];
    }

    async listByOwnerId() {
      return [];
    }
  }

  return {
    createApiLedgerReadRuntime: vi.fn((db: { execute: typeof fakeDbExecute }) => ({
      balancesQueries: {} as const,
      booksQueries: new FakeBooksQueries(db),
      operationsQueries: {
        list: vi.fn(async () => ({
          data: [],
          total: 0,
          limit: 20,
          offset: 0,
        })),
        listDetails: listOperationDetails,
        getDetails: vi.fn(async () => null),
      },
      reportsQueries: {
        listScopedPostingRows: vi.fn(async () => []),
      },
    })),
  };
});

vi.mock("../../src/composition/parties-module", () => ({
  createApiPartiesReadRuntime: vi.fn(() => ({
    counterpartiesQueries: {
      listShortNamesById: vi.fn(async () => new Map()),
    },
    customersQueries: {
      listDisplayNamesById: vi.fn(async () => new Map()),
    },
    organizationsQueries: {
      listShortNamesById: listOrganizationShortNamesById,
      assertInternalLedgerOrganization: vi.fn(async () => undefined),
    },
    requisitesQueries: {
      listLabelsById: vi.fn(async () => new Map()),
    },
  })),
}));

import { createApiAccountingModule } from "../../src/composition/accounting-module";

describe("API accounting module composition", () => {
  it("keeps book-query context when loading labeled operation details", async () => {
    const accountingModule = createApiAccountingModule({
      db: {
        execute: fakeDbExecute,
      } as any,
      logger: {
        child: vi.fn(function child() {
          return this;
        }),
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      } as any,
      persistence: {} as any,
    });

    const result =
      await accountingModule.reports.queries.listOperationDetailsWithLabels([
        "11111111-1111-4111-8111-111111111111",
      ]);

    expect(fakeDbExecute).toHaveBeenCalledWith({
      kind: "list-books",
      ids: ["book-1"],
    });
    expect(listOrganizationShortNamesById).toHaveBeenCalledWith([
      "00000000-0000-4000-8000-000000000310",
    ]);
    expect(
      result.get("11111111-1111-4111-8111-111111111111")?.postings[0]?.bookName,
    ).toBe(
      "Organization BEDROCK default book",
    );
  });
});
