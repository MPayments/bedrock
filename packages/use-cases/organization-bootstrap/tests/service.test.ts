import { describe, expect, it, vi } from "vitest";

const create = vi.fn(async () => ({ id: "org-1", shortName: "Acme" }));
vi.mock("@bedrock/parties/adapters/drizzle", () => ({
  createPartiesModuleFromDrizzle: vi.fn(() => ({
    organizations: {
      commands: {
        create,
      },
    },
  })),
}));

import { createOrganizationBootstrapService } from "../src";

describe("organization bootstrap service", () => {
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
    const service = createOrganizationBootstrapService({
      db: db as any,
      createLedgerModule: createLedgerModule as any,
    });

    const result = await service.create({
      shortName: "Acme",
    } as any);

    expect(result.id).toBe("org-1");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ shortName: "Acme" });
    expect(createLedgerModule).toHaveBeenCalledWith(tx);
    expect(ensureDefaultOrganizationBook).toHaveBeenCalledWith({
      organizationId: "org-1",
    });
  });
});
