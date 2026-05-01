import { describe, expect, it } from "vitest";

import {
  bindAssertInternalLedgerOrganization,
  bindListBooksByOwnerId,
} from "../src/adapters/drizzle";

describe("drizzle accounting adapter", () => {
  it("binds organization assertion methods before passing them to period close ports", async () => {
    const calls: string[] = [];
    const organizationsQueries = {
      organizationReads: {
        assertInternalLedgerOrganization(organizationId: string) {
          calls.push(organizationId);
        },
      },
      async assertInternalLedgerOrganization(organizationId: string) {
        this.organizationReads.assertInternalLedgerOrganization(organizationId);
      },
    };

    const assertInternalLedgerOrganization =
      bindAssertInternalLedgerOrganization(organizationsQueries as never);

    await expect(
      assertInternalLedgerOrganization("organization-1"),
    ).resolves.toBeUndefined();
    expect(calls).toEqual(["organization-1"]);
  });

  it("binds ledger book query methods before passing them to period close ports", async () => {
    const calls: string[] = [];
    const booksQueries = {
      db: {
        async listByOwnerId(ownerId: string) {
          calls.push(ownerId);
          return [{ id: "book-1" }];
        },
      },
      async listByOwnerId(ownerId: string) {
        return this.db.listByOwnerId(ownerId);
      },
    };

    const listBooksByOwnerId = bindListBooksByOwnerId(booksQueries as never);

    await expect(listBooksByOwnerId("organization-1")).resolves.toEqual([
      { id: "book-1" },
    ]);
    expect(calls).toEqual(["organization-1"]);
  });
});
