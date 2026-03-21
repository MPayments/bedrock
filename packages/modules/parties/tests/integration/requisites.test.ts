import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { books, bookAccountInstances } from "@bedrock/ledger/schema";

import { createIntegrationRuntime } from "./runtime";
import { db, pool } from "./setup";
import { schema as partiesSchema } from "../../src/schema";

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

async function getCurrency() {
  const result = await pool.query<{ id: string; code: string }>(
    "select id, code from currencies order by code limit 1",
  );

  return result.rows[0]!;
}

describe("parties requisites integration", () => {
  it("creates, lists, finds, updates, and archives requisites", async () => {
    const { module, queries } = createIntegrationRuntime();
    const currency = await getCurrency();
    const organization = await module.organizations.commands.create({
      shortName: uniqueLabel("Org"),
      fullName: "Organization",
    });
    const provider = await module.requisites.commands.createProvider({
      kind: "bank",
      name: uniqueLabel("Provider"),
      country: "US",
      swift: "BOFAUS3N",
    });

    const created = await module.requisites.commands.create({
      ownerType: "organization",
      ownerId: organization.id,
      providerId: provider.id,
      currencyId: currency.id,
      kind: "bank",
      label: "Main",
      description: null,
      beneficiaryName: "Acme Corp",
      institutionName: "Bank",
      institutionCountry: "US",
      accountNo: "12345",
      isDefault: true,
    });
    expect(created.isDefault).toBe(true);

    const listed = await module.requisites.queries.list({
      ownerType: "organization",
      ownerId: organization.id,
    });
    expect(listed.total).toBe(1);

    const found = await module.requisites.queries.findById(created.id);
    expect(found.id).toBe(created.id);

    const options = await module.requisites.queries.listOptions({
      ownerType: "organization",
      ownerId: organization.id,
    });
    expect(options[0]?.label).toContain("Main");

    const labels = await queries.requisites.listLabelsById([created.id]);
    expect(labels.get(created.id)).toBe("Main");

    const updated = await module.requisites.commands.update(created.id, {
      label: "Main Updated",
    });
    expect(updated.label).toBe("Main Updated");

    await module.requisites.commands.remove(created.id);

    const [archived] = await db
      .select()
      .from(partiesSchema.requisites)
      .where(eq(partiesSchema.requisites.id, created.id));
    expect(archived?.archivedAt).not.toBeNull();
  });

  it("creates, lists, finds, archives providers and manages bindings", async () => {
    const { module, queries } = createIntegrationRuntime();
    const currency = await getCurrency();
    const organization = await module.organizations.commands.create({
      shortName: uniqueLabel("Org"),
      fullName: "Organization",
    });
    const provider = await module.requisites.commands.createProvider({
      kind: "bank",
      name: uniqueLabel("Provider"),
      country: "US",
      swift: "CHASUS33",
    });

    const providerList = await module.requisites.queries.listProviders({
      name: provider.name,
    });
    expect(providerList.total).toBe(1);

    const providerFound = await module.requisites.queries.findProviderById(
      provider.id,
    );
    expect(providerFound.id).toBe(provider.id);

    const updatedProvider = await module.requisites.commands.updateProvider(
      provider.id,
      { name: `${provider.name}-updated` },
    );
    expect(updatedProvider.name).toContain("updated");

    const requisite = await module.requisites.commands.create({
      ownerType: "organization",
      ownerId: organization.id,
      providerId: provider.id,
      currencyId: currency.id,
      kind: "bank",
      label: "Binding Requisite",
      description: null,
      beneficiaryName: "Acme Corp",
      institutionName: "Bank",
      institutionCountry: "US",
      accountNo: "98765",
    });

    const [book] = await db
      .insert(books)
      .values({
        ownerId: organization.id,
        code: uniqueLabel("book"),
        name: "Main Book",
        isDefault: true,
      })
      .returning();
    const [accountInstance] = await db
      .insert(bookAccountInstances)
      .values({
        bookId: book!.id,
        accountNo: "1010",
        currency: currency.code,
        dimensions: {},
        dimensionsHash: createHash("sha256").update("{}").digest("hex"),
        tbLedger: 1,
        tbAccountId: 1n,
      })
      .returning();

    const binding = await module.requisites.commands.upsertBinding({
      requisiteId: requisite.id,
      bookId: book!.id,
      bookAccountInstanceId: accountInstance!.id,
      postingAccountNo: "1010",
    });
    expect(binding.organizationId).toBe(organization.id);

    const fetchedBinding = await module.requisites.queries.getBinding(
      requisite.id,
    );
    expect(fetchedBinding.bookId).toBe(book!.id);

    const resolved = await module.requisites.queries.resolveBindings({
      requisiteIds: [requisite.id],
    });
    expect(resolved).toHaveLength(1);

    const helperBinding = await queries.requisites.bindings.findByRequisiteId(
      requisite.id,
    );
    expect(helperBinding?.bookId).toBe(book!.id);

    await module.requisites.commands.removeProvider(provider.id);

    const [archivedProvider] = await db
      .select()
      .from(partiesSchema.requisiteProviders)
      .where(eq(partiesSchema.requisiteProviders.id, provider.id));
    expect(archivedProvider?.archivedAt).not.toBeNull();
  });
});
