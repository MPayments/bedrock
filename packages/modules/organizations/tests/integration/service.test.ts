import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { createLedgerBooksService } from "@bedrock/ledger";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";

import {
  db,
  ensureDeleteGuardTable,
  pool,
  trackBookId,
  trackOrganizationId,
} from "./setup";
import {
  OrganizationDeleteConflictError,
  OrganizationInternalLedgerInvariantError,
  OrganizationNotFoundError,
} from "../../src/errors";
import { schema as organizationsSchema } from "../../src/infra/drizzle/schema";
import { createOrganizationsQueries } from "../../src/queries";
import { createOrganizationsService } from "../../src/service";

const ledgerBooks = createLedgerBooksService();

function createOrganizationsRuntime() {
  return {
    service: createOrganizationsService({ db, ledgerBooks }),
    queries: createOrganizationsQueries({ db }),
  };
}

function createOrganizationPayload(suffix = randomUUID()) {
  return {
    shortName: `org-it-${suffix.slice(0, 8)}`,
    fullName: `Organizations Integration ${suffix}`,
    externalId: `org-it-${suffix}`,
    country: "us",
  };
}

async function findDefaultBookId(organizationId: string): Promise<string> {
  const [book] = await db
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(
      and(
        eq(ledgerSchema.books.ownerId, organizationId),
        eq(ledgerSchema.books.isDefault, true),
      ),
    )
    .limit(1);

  expect(book).toBeDefined();
  return book!.id;
}

describe("organizations integration", () => {
  beforeAll(async () => {
    await ensureDeleteGuardTable();
  });

  it("creates, lists, updates, finds, and removes organizations while provisioning a default book", async () => {
    const { service } = createOrganizationsRuntime();
    const created = await service.create(createOrganizationPayload());
    trackOrganizationId(created.id);

    const defaultBookId = await findDefaultBookId(created.id);
    trackBookId(defaultBookId);

    expect(created.country).toBe("US");

    const listed = await service.list({
      limit: 10,
      offset: 0,
      shortName: created.shortName.slice(0, 6),
      sortBy: "shortName",
      sortOrder: "asc",
    });

    expect(listed.data.some((row) => row.id === created.id)).toBe(true);

    const found = await service.findById(created.id);
    expect(found.id).toBe(created.id);

    const updated = await service.update(created.id, {
      description: "updated in integration test",
      externalId: `org-it-updated-${randomUUID()}`,
    });

    expect(updated.description).toBe("updated in integration test");

    await service.remove(created.id);
    await expect(service.findById(created.id)).rejects.toBeInstanceOf(
      OrganizationNotFoundError,
    );
  });

  it("exposes internal-ledger organization queries and book ownership guards", async () => {
    const { queries, service } = createOrganizationsRuntime();
    const first = await service.create(createOrganizationPayload());
    const second = await service.create(createOrganizationPayload());
    trackOrganizationId(first.id);
    trackOrganizationId(second.id);

    const firstBookId = await findDefaultBookId(first.id);
    const secondBookId = await findDefaultBookId(second.id);
    trackBookId(firstBookId);
    trackBookId(secondBookId);

    const shortNames = await queries.listShortNamesById([
      first.id,
      second.id,
      randomUUID(),
    ]);
    const internalIds = await queries.listInternalLedgerOrganizationIds();
    const internalOrgs = await queries.listInternalLedgerOrganizations();

    expect(shortNames.get(first.id)).toBe(first.shortName);
    expect(shortNames.get(second.id)).toBe(second.shortName);
    expect(internalIds).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(internalOrgs.map((row) => row.id)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );

    await expect(
      queries.isInternalLedgerOrganization(first.id),
    ).resolves.toBe(true);
    await expect(
      queries.assertInternalLedgerOrganization(first.id),
    ).resolves.toBeUndefined();
    await expect(
      queries.assertInternalLedgerOrganization(randomUUID()),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);

    await expect(
      queries.assertBooksBelongToInternalLedgerOrganizations([
        firstBookId,
        secondBookId,
      ]),
    ).resolves.toBeUndefined();
    await expect(
      queries.assertBooksBelongToInternalLedgerOrganizations([randomUUID()]),
    ).rejects.toBeInstanceOf(OrganizationInternalLedgerInvariantError);

    const nonOrganizationBookId = randomUUID();
    trackBookId(nonOrganizationBookId);
    await db.insert(ledgerSchema.books).values({
      id: nonOrganizationBookId,
      ownerId: randomUUID(),
      code: `org-it-book:${nonOrganizationBookId}`,
      name: "Non organization book",
      isDefault: false,
    });

    await expect(
      queries.assertBooksBelongToInternalLedgerOrganizations([
        nonOrganizationBookId,
      ]),
    ).rejects.toBeInstanceOf(OrganizationInternalLedgerInvariantError);
  });

  it("rolls back organization creation when default-book provisioning fails", async () => {
    const failureExternalId = `org-it-${randomUUID()}`;
    const service = createOrganizationsService({
      db,
      ledgerBooks: {
        async ensureDefaultOrganizationBook() {
          throw new Error("ledger books unavailable");
        },
      },
    });

    await expect(
      service.create({
        shortName: "Rollback Org",
        fullName: "Rollback Organization",
        externalId: failureExternalId,
      }),
    ).rejects.toThrow("ledger books unavailable");

    const rows = await db
      .select()
      .from(organizationsSchema.organizations)
      .where(eq(organizationsSchema.organizations.externalId, failureExternalId));

    expect(rows).toHaveLength(0);
  });

  it("returns delete conflict when a foreign key blocks organization deletion", async () => {
    const { service } = createOrganizationsRuntime();
    const created = await service.create(createOrganizationPayload());
    trackOrganizationId(created.id);

    const defaultBookId = await findDefaultBookId(created.id);
    trackBookId(defaultBookId);

    await pool.query(
      "INSERT INTO organizations_delete_guards (organization_id) VALUES ($1::uuid)",
      [created.id],
    );

    await expect(service.remove(created.id)).rejects.toBeInstanceOf(
      OrganizationDeleteConflictError,
    );

    await expect(service.findById(created.id)).resolves.toEqual(
      expect.objectContaining({ id: created.id }),
    );
  });
});
