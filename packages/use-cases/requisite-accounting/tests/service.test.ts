import { describe, expect, it, vi } from "vitest";

const BANK_ACCOUNT_NO = "1110";

const create = vi.fn(async () => ({
  id: "req-1",
  ownerType: "organization",
  ownerId: "org-1",
  currencyId: "cur-1",
}));
const update = vi.fn();
const upsertBinding = vi.fn(async () => ({
  requisiteId: "req-1",
  organizationId: "org-1",
  currencyCode: "USD",
  bookId: "book-1",
  bookAccountInstanceId: "instance-1",
  postingAccountNo: BANK_ACCOUNT_NO,
}));
const findById = vi.fn(async () => ({
  id: "req-1",
  ownerType: "organization",
  ownerId: "org-1",
  currencyId: "cur-1",
}));

vi.mock("@bedrock/parties/adapters/drizzle", () => ({
  createPartiesModuleFromDrizzle: vi.fn(() => ({
    requisites: {
      commands: {
        create,
        update,
        upsertBinding,
      },
      queries: {
        findById,
      },
    },
  })),
}));

import { createRequisiteAccountingService } from "../src";

describe("requisite accounting service", () => {
  it("syncs organization bindings after create", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) =>
        run(tx),
      ),
    };
    const ensureDefaultOrganizationBook = vi.fn(async () => ({
      bookId: "book-1",
    }));
    const ensureBookAccountInstance = vi.fn(async () => ({
      id: "instance-1",
      dimensionsHash: "hash-1",
      tbLedger: 1,
      tbAccountId: 1n,
    }));
    const createLedgerModule = vi.fn(() => ({
      books: {
        commands: {
          ensureDefaultOrganizationBook,
        },
      },
      bookAccounts: {
        commands: {
          ensureBookAccountInstance,
        },
      },
    }));
    const service = createRequisiteAccountingService({
      db: db as any,
      createLedgerModule: createLedgerModule as any,
      currencies: {
        assertCurrencyExists: vi.fn(),
        findByCode: vi.fn(async () => ({
          code: "USD",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          id: "cur-1",
          name: "US Dollar",
          precision: 2,
          symbol: "$",
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        })),
        listCodesById: vi.fn(async () => new Map([["cur-1", "USD"]])),
      },
    });

    const result = await service.create({ ownerType: "organization" } as any);

    expect(result.id).toBe("req-1");
    expect(createLedgerModule).toHaveBeenCalledWith(tx);
    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
    expect(ensureBookAccountInstance).toHaveBeenCalledWith({
      accountNo: BANK_ACCOUNT_NO,
      bookId: "book-1",
      currency: "USD",
      dimensions: {},
    });
    expect(upsertBinding).toHaveBeenCalledWith({
      requisiteId: "req-1",
      bookId: "book-1",
      bookAccountInstanceId: "instance-1",
      postingAccountNo: BANK_ACCOUNT_NO,
    });
  });
});
