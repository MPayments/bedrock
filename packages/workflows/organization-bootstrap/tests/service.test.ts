import { describe, expect, it, vi } from "vitest";

const create = vi.fn(async () => ({ id: "org-1", shortName: "Acme" }));
const upsertFromCanonical = vi.fn(async () => ({ id: 1, organizationId: "org-1" }));

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

vi.mock("@bedrock/operations/adapters/drizzle", () => ({
  DrizzleHoldingOrganizationBridge: vi.fn(function MockHoldingOrganizationBridge() {
    return {
      upsertFromCanonical,
    };
  }),
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
    const ensureDefaultOrganizationBook = vi.fn(async () => ({
      bookId: "book-1",
    }));
    const createLedgerModule = vi.fn(() => ({
      books: {
        commands: {
          ensureDefaultOrganizationBook,
        },
      },
    }));
    const workflow = createOrganizationBootstrapWorkflow({
      db: db as any,
      createLedgerModule: createLedgerModule as any,
    });

    const result = await workflow.create({
      shortName: "Acme",
    } as any);

    expect(result.id).toBe("org-1");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ shortName: "Acme" });
    expect(createLedgerModule).toHaveBeenCalledWith(tx);
    expect(upsertFromCanonical).toHaveBeenCalledWith({
      id: "org-1",
      shortName: "Acme",
    });
    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
  });
});
