import { describe, expect, it, vi } from "vitest";

import { ACCOUNT_NO } from "@bedrock/accounting/constants";

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
  postingAccountNo: ACCOUNT_NO.BANK,
}));
const findById = vi.fn(async () => ({
  id: "req-1",
  ownerType: "organization",
  ownerId: "org-1",
  currencyId: "cur-1",
}));

vi.mock("@bedrock/parties", () => ({
  createPartiesModule: vi.fn(() => ({
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
  RequisiteAccountingBindingOwnerTypeError: class extends Error {},
  RequisiteNotFoundError: class extends Error {},
}));

vi.mock("@bedrock/parties/adapters/drizzle", () => ({
  DrizzleCounterpartyGroupReads: vi.fn(),
  DrizzleCounterpartyReads: vi.fn(),
  DrizzleCustomerReads: vi.fn(),
  DrizzleOrganizationReads: vi.fn(),
  DrizzlePartyRegistryUnitOfWork: vi.fn(),
  DrizzleRequisiteBindingReads: vi.fn(),
  DrizzleRequisiteProviderReads: vi.fn(),
  DrizzleRequisiteReads: vi.fn(),
}));

vi.mock("@bedrock/platform/persistence", async () => {
  const actual = await vi.importActual("@bedrock/platform/persistence");
  return {
    ...actual,
    bindPersistenceSession: vi.fn(() => ({})),
  };
});

import { createRequisiteAccountingWorkflow } from "../src";

describe("requisite accounting workflow", () => {
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
    const workflow = createRequisiteAccountingWorkflow({
      db: db as any,
      createLedgerModule: createLedgerModule as any,
      currencies: {
        assertCurrencyExists: vi.fn(),
        listCodesById: vi.fn(async () => new Map([["cur-1", "USD"]])),
      },
    });

    const result = await workflow.create({ ownerType: "organization" } as any);

    expect(result.id).toBe("req-1");
    expect(createLedgerModule).toHaveBeenCalledWith(tx);
    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
    expect(ensureBookAccountInstance).toHaveBeenCalledWith({
      accountNo: ACCOUNT_NO.BANK,
      bookId: "book-1",
      currency: "USD",
      dimensions: {},
    });
    expect(upsertBinding).toHaveBeenCalledWith({
      requisiteId: "req-1",
      bookId: "book-1",
      bookAccountInstanceId: "instance-1",
      postingAccountNo: ACCOUNT_NO.BANK,
    });
  });
});
