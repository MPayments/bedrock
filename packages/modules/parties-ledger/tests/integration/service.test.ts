import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as organizationsSchema } from "@bedrock/parties/organizations/schema";
import { schema as requisiteProvidersSchema } from "@bedrock/parties/requisite-providers/schema";
import { schema as requisitesSchema } from "@bedrock/parties/requisites/schema";

import { ensureRequisiteAccountingBindingTx } from "../../src/bindings";
import { ensureOrganizationDefaultBookIdTx } from "../../src/default-books";
import { schema } from "../../src/schema";
import { db } from "./setup";

async function seedOrganizationRequisiteFixture() {
  const suffix = randomUUID();
  const organizationId = randomUUID();
  const providerId = randomUUID();
  const currencyId = randomUUID();
  const requisiteId = randomUUID();
  const currencyCode = `XPL${suffix.slice(0, 4).toUpperCase()}`;

  await db.insert(organizationsSchema.organizations).values({
    id: organizationId,
    externalId: `pl-it-${suffix}`,
    shortName: `pl-it-org-${suffix.slice(0, 8)}`,
    fullName: `Parties Ledger Integration Org ${suffix}`,
    country: "US",
    kind: "legal_entity",
  });

  await db.insert(requisiteProvidersSchema.requisiteProviders).values({
    id: providerId,
    kind: "bank",
    name: `pl-it-provider-${suffix}`,
    country: "US",
  });

  await db.insert(currenciesSchema.currencies).values({
    id: currencyId,
    code: currencyCode,
    name: `PL ${currencyCode}`,
    symbol: currencyCode,
    precision: 2,
  });

  await db.insert(requisitesSchema.requisites).values({
    id: requisiteId,
    ownerType: "organization",
    organizationId,
    providerId,
    currencyId,
    kind: "bank",
    label: `pl-it-${suffix}`,
    beneficiaryName: "Parties Ledger Test",
    institutionName: "Integration Bank",
    institutionCountry: "US",
    accountNo: `ACC-${suffix.slice(0, 12)}`,
    isDefault: false,
  });

  return {
    organizationId,
    requisiteId,
    currencyCode,
  };
}

describe("parties-ledger integration", () => {
  it("creates one default organization book and reuses it on repeated resolution", async () => {
    const organizationId = randomUUID();

    const firstBookId = await db.transaction((tx) =>
      ensureOrganizationDefaultBookIdTx(tx, organizationId),
    );
    const secondBookId = await db.transaction((tx) =>
      ensureOrganizationDefaultBookIdTx(tx, organizationId),
    );

    expect(secondBookId).toBe(firstBookId);

    const rows = await db
      .select()
      .from(schema.books)
      .where(
        and(
          eq(schema.books.ownerId, organizationId),
          eq(schema.books.isDefault, true),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: firstBookId,
        ownerId: organizationId,
        code: `organization-default:${organizationId}`,
        isDefault: true,
      }),
    );
  });

  it("upserts requisite accounting bindings and reuses the default organization book", async () => {
    const fixture = await seedOrganizationRequisiteFixture();

    const first = await db.transaction((tx) =>
      ensureRequisiteAccountingBindingTx(tx, {
        requisiteId: fixture.requisiteId,
        organizationId: fixture.organizationId,
        currencyCode: fixture.currencyCode,
        postingAccountNo: "1010",
      }),
    );

    const second = await db.transaction((tx) =>
      ensureRequisiteAccountingBindingTx(tx, {
        requisiteId: fixture.requisiteId,
        organizationId: fixture.organizationId,
        currencyCode: fixture.currencyCode,
        postingAccountNo: "2020",
      }),
    );

    expect(second.requisiteId).toBe(fixture.requisiteId);
    expect(second.bookId).toBe(first.bookId);
    expect(second.postingAccountNo).toBe("2020");
    expect(second.bookAccountInstanceId).not.toBe(first.bookAccountInstanceId);

    const books = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.ownerId, fixture.organizationId));
    expect(books).toHaveLength(1);

    const [bindingRow] = await db
      .select()
      .from(schema.requisiteAccountingBindings)
      .where(
        eq(schema.requisiteAccountingBindings.requisiteId, fixture.requisiteId),
      )
      .limit(1);

    expect(bindingRow).toEqual(
      expect.objectContaining({
        requisiteId: fixture.requisiteId,
        bookId: first.bookId,
        bookAccountInstanceId: second.bookAccountInstanceId,
        postingAccountNo: "2020",
      }),
    );

    const accountInstances = await db
      .select()
      .from(schema.bookAccountInstances)
      .where(eq(schema.bookAccountInstances.bookId, first.bookId));

    expect(accountInstances).toHaveLength(2);
    expect(accountInstances.map((row) => row.accountNo).sort()).toEqual([
      "1010",
      "2020",
    ]);
    expect(accountInstances.every((row) => row.currency === fixture.currencyCode)).toBe(
      true,
    );
  });
});
