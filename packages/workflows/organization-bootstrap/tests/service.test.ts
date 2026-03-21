import { describe, expect, it, vi } from "vitest";

const create = vi.fn(async () => ({ id: "org-1", shortName: "Acme" }));

vi.mock("@bedrock/parties", () => ({
  createPartiesModule: vi.fn(() => ({
    organizations: {
      commands: {
        create,
      },
    },
  })),
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

import { createOrganizationBootstrapWorkflow } from "../src";

describe("organization bootstrap workflow", () => {
  it("creates an organization and provisions the default book in one transaction", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) => run(tx)),
    };
    const ledgerBooks = {
      ensureDefaultOrganizationBook: vi.fn(async () => ({ bookId: "book-1" })),
    };
    const workflow = createOrganizationBootstrapWorkflow({
      db: db as any,
      ledgerBooks,
    });

    const result = await workflow.create({
      shortName: "Acme",
    } as any);

    expect(result.id).toBe("org-1");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ shortName: "Acme" });
    expect(ledgerBooks.ensureDefaultOrganizationBook).toHaveBeenCalledWith(tx, {
      organizationId: "org-1",
    });
  });
});
