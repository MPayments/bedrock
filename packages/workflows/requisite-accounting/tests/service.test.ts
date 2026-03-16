import { describe, expect, it, vi } from "vitest";

import { ACCOUNT_NO } from "@bedrock/accounting/constants";

const create = vi.fn(async () => ({
  id: "req-1",
  ownerType: "organization",
  ownerId: "org-1",
  currencyId: "cur-1",
}));
const update = vi.fn();
const bindingsUpsert = vi.fn(async () => undefined);
const bindingsGet = vi.fn(async () => ({
  requisiteId: "req-1",
  postingAccountNo: ACCOUNT_NO.BANK,
}));

vi.mock("@bedrock/requisites", () => ({
  createRequisitesServiceFromTransaction: vi.fn(() => ({
    create,
    update,
    bindings: {
      upsert: bindingsUpsert,
      get: bindingsGet,
    },
  })),
  RequisiteAccountingBindingOwnerTypeError: class extends Error {},
  RequisiteNotFoundError: class extends Error {},
}));

vi.mock("@bedrock/requisites/queries", () => ({
  createRequisitesQueries: vi.fn(() => ({
    findSubjectById: vi.fn(),
  })),
}));

import { createRequisiteAccountingWorkflow } from "../src";

describe("requisite accounting workflow", () => {
  it("syncs organization bindings after create", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) => run(tx)),
    };
    const workflow = createRequisiteAccountingWorkflow({
      db: db as any,
      ledgerBooks: {
        ensureDefaultOrganizationBook: vi.fn(async () => ({ bookId: "book-1" })),
      },
      ledgerBookAccounts: {
        ensureBookAccountInstance: vi.fn(async () => ({
          id: "instance-1",
          dimensionsHash: "hash-1",
          tbLedger: 1,
          tbAccountId: 1n,
        })),
      },
      currencies: {
        assertCurrencyExists: vi.fn(),
        listCodesById: vi.fn(async () => new Map([["cur-1", "USD"]])),
      },
      owners: {
        assertOrganizationExists: vi.fn(),
        assertCounterpartyExists: vi.fn(),
      },
    });

    const result = await workflow.create({ ownerType: "organization" } as any);

    expect(result.id).toBe("req-1");
    expect(bindingsUpsert).toHaveBeenCalledWith({
      requisiteId: "req-1",
      bookId: "book-1",
      bookAccountInstanceId: "instance-1",
      postingAccountNo: ACCOUNT_NO.BANK,
    });
    expect(bindingsGet).toHaveBeenCalledWith("req-1");
  });
});
