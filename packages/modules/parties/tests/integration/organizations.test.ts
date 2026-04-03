import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { books } from "@bedrock/ledger/schema";

import { createIntegrationRuntime } from "./runtime";
import { db } from "./setup";
import { schema as partiesSchema } from "../../src/schema";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

describe("parties organizations integration", () => {
  it("creates, lists, finds, updates, and removes organizations", async () => {
    const { module, queries } = createIntegrationRuntime();
    const created = await module.organizations.commands.create({
      shortName: uniqueLabel("Acme"),
      fullName: "Acme Incorporated",
      country: "US",
    });

    const listed = await module.organizations.queries.list({
      shortName: created.shortName,
    });
    expect(listed.total).toBe(1);
    expect(listed.data[0]?.id).toBe(created.id);

    const found = await module.organizations.queries.findById(created.id);
    expect(found.id).toBe(created.id);

    const shortNames = await queries.organizations.listShortNamesById([
      created.id,
    ]);
    expect(shortNames.get(created.id)).toBe(created.shortName);

    const ids = await queries.organizations.listInternalLedgerOrganizationIds();
    expect(ids).toContain(created.id);
    await expect(
      queries.organizations.assertInternalLedgerOrganization(created.id),
    ).resolves.toBeUndefined();

    const [book] = await db
      .insert(books)
      .values({
        ownerId: created.id,
        code: uniqueLabel("book"),
        name: "Main Book",
        isDefault: true,
      })
      .returning();
    await expect(
      queries.organizations.assertBooksBelongToInternalLedgerOrganizations([
        book!.id,
      ]),
    ).resolves.toBeUndefined();

    const updated = await module.organizations.commands.update(created.id, {
      shortName: `${created.shortName}-updated`,
    });
    expect(updated.shortName).toContain("updated");

    await module.organizations.commands.remove(created.id);

    const rows = await db
      .select()
      .from(partiesSchema.organizations)
      .where(eq(partiesSchema.organizations.id, created.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isActive).toBe(false);

    const activeOnly = await module.organizations.queries.list({
      isActive: true,
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(activeOnly.data.some((item) => item.id === created.id)).toBe(false);
  });
});
