import { beforeEach, describe, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({
  accountingModuleInput: null as any,
}));

vi.mock("@bedrock/accounting", () => ({
  createAccountingModule: vi.fn((input) => input),
}));

vi.mock("@bedrock/accounting/adapters/drizzle", () => ({
  createDrizzleAccountingModule: vi.fn((input) => {
    captures.accountingModuleInput = input;
    return input;
  }),
}));

vi.mock("@bedrock/currencies/queries", () => ({
  createCurrenciesQueries: vi.fn(() => ({
    listPrecisionsByCode: vi.fn(async () => new Map()),
  })),
}));

vi.mock("@bedrock/documents/read-model", () => ({
  createDrizzleDocumentsReadModel: vi.fn(() => ({})),
}));

vi.mock("../../src/composition/book-labels", () => ({
  relabelOrganizationBookNames: vi.fn(({ books }) => books),
}));

vi.mock("../../src/composition/ledger-module", () => ({
  createApiLedgerReadRuntime: vi.fn(() => ({
    balancesQueries: {},
    booksQueries: {
      prefix: "books",
      async listById(this: { prefix: string }, ids: string[]) {
        if (this.prefix !== "books") {
          throw new TypeError("unbound books query");
        }

        return ids.map((id) => ({
          id,
          name: `Book ${id}`,
          ownerId: "org-1",
        }));
      },
      async listByOwnerId(this: { prefix: string }, ownerId: string) {
        if (this.prefix !== "books") {
          throw new TypeError("unbound books owner query");
        }

        return [{ id: `book-${ownerId}` }];
      },
    },
    operationsQueries: {
      prefix: "operations",
      async getDetails(this: { prefix: string }, operationId: string) {
        if (this.prefix !== "operations") {
          throw new TypeError("unbound operation details query");
        }

        return { id: operationId };
      },
      async list(this: { prefix: string }, query: unknown) {
        if (this.prefix !== "operations") {
          throw new TypeError("unbound operations list query");
        }

        return { query };
      },
      async listDetails(this: { prefix: string }, operationIds: string[]) {
        if (this.prefix !== "operations") {
          throw new TypeError("unbound operation details list query");
        }

        return new Map([["operation-1", operationIds]]);
      },
    },
    reportsQueries: {
      listScopedPostingRows: vi.fn(async () => []),
    },
  })),
}));

vi.mock("../../src/composition/parties-module", () => ({
  createApiPartiesReadRuntime: vi.fn(() => ({
    counterpartiesQueries: {},
    customersQueries: {},
    organizationsQueries: {
      assertInternalLedgerOrganization: vi.fn(),
      listShortNamesById: vi.fn(
        async (ids: string[]) => new Map(ids.map((id) => [id, id])),
      ),
    },
    requisitesQueries: {},
  })),
}));

describe("accounting module composition", () => {
  beforeEach(() => {
    captures.accountingModuleInput = null;
    vi.clearAllMocks();
  });

  it("passes read runtimes and labeled book lookup into the shared accounting adapter", async () => {
    const { createApiAccountingModule } =
      await import("../../src/composition/accounting-module");

    createApiAccountingModule({
      db: {} as never,
      persistence: {} as never,
      logger: {} as never,
    });

    expect(captures.accountingModuleInput.ledgerReadRuntime).toBeDefined();
    expect(captures.accountingModuleInput.partiesReadRuntime).toBeDefined();
    expect(captures.accountingModuleInput.documentsReadModel).toBeDefined();
    await expect(
      captures.accountingModuleInput.listBooksById(["book-1"]),
    ).resolves.toEqual([
      {
        id: "book-1",
        name: "Book book-1",
        ownerId: "org-1",
      },
    ]);
  });
});
