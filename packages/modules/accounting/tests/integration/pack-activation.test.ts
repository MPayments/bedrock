import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createAccountingPacksService } from "@bedrock/accounting/packs";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { schema as accountingSchema } from "@bedrock/accounting/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";

const schema = {
  ...accountingSchema,
  ...ledgerSchema,
};

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false,
});

const db = drizzle(pool, { schema });
const createdBookIds = new Set<string>();
const TEST_INTERNAL_ORGANIZATION_ID = "00000000-0000-4000-8000-00000000f202";

async function resolveInternalLedgerOrganizationId(): Promise<string> {
  await pool.query(
    `
      INSERT INTO organizations (id, short_name, full_name, kind, country)
      VALUES ($1::uuid, 'Integration Internal Organization', 'Integration Internal Organization', 'legal_entity', 'US')
      ON CONFLICT (id) DO UPDATE
      SET short_name = EXCLUDED.short_name,
          full_name = EXCLUDED.full_name,
          kind = EXCLUDED.kind,
          country = EXCLUDED.country
    `,
    [TEST_INTERNAL_ORGANIZATION_ID],
  );

  return TEST_INTERNAL_ORGANIZATION_ID;
}

async function cleanupCreatedBooks() {
  const bookIds = Array.from(createdBookIds);
  if (bookIds.length === 0) {
    return;
  }

  await db
    .delete(accountingSchema.accountingPackAssignments)
    .where(inArray(accountingSchema.accountingPackAssignments.scopeId, bookIds));
  await db.delete(ledgerSchema.books).where(inArray(ledgerSchema.books.id, bookIds));
  createdBookIds.clear();
}

describe("accounting pack activation integration", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  afterEach(async () => {
    await cleanupCreatedBooks();
  });

  afterAll(async () => {
    await cleanupCreatedBooks();
    await pool.end();
  });

  it("stores, activates, and loads a compiled pack for a book scope", async () => {
    const packsService = createAccountingPacksService({
      db,
      defaultPackDefinition: rawPackDefinition,
    });
    const bookId = randomUUID();
    const internalOrganizationId = await resolveInternalLedgerOrganizationId();
    createdBookIds.add(bookId);

    await db.insert(ledgerSchema.books).values({
      id: bookId,
      ownerId: internalOrganizationId,
      code: `it-pack-${bookId}`,
      name: "Integration Pack Book",
      isDefault: false,
    });

    const compiled = await packsService.storeCompiledPackVersion({
      definition: rawPackDefinition,
    });
    const effectiveAt = new Date("2026-02-28T09:00:00.000Z");

    await packsService.activatePackForScope({
      scopeId: bookId,
      packChecksum: compiled.checksum,
      effectiveAt,
    });

    const loaded = await packsService.loadActiveCompiledPackForBook({
      bookId,
      at: new Date("2026-02-28T10:00:00.000Z"),
    });

    expect(loaded.checksum).toBe(compiled.checksum);

    const [assignment] = await db
      .select()
      .from(accountingSchema.accountingPackAssignments)
      .where(eq(accountingSchema.accountingPackAssignments.scopeId, bookId))
      .limit(1);

    expect(assignment).toEqual(
      expect.objectContaining({
        scopeType: "book",
        scopeId: bookId,
        packChecksum: compiled.checksum,
      }),
    );
  });

  it("resolves the active pack by effective date", async () => {
    const packsService = createAccountingPacksService({
      db,
      defaultPackDefinition: rawPackDefinition,
    });
    const bookId = randomUUID();
    const internalOrganizationId = await resolveInternalLedgerOrganizationId();
    createdBookIds.add(bookId);

    await db.insert(ledgerSchema.books).values({
      id: bookId,
      ownerId: internalOrganizationId,
      code: `it-pack-effective-${bookId}`,
      name: "Integration Effective Pack Book",
      isDefault: false,
    });

    const futureCompiled = await packsService.storeCompiledPackVersion({
      definition: {
        ...rawPackDefinition,
        version: rawPackDefinition.version + 1,
      },
    });

    await packsService.activatePackForScope({
      scopeId: bookId,
      packChecksum: futureCompiled.checksum,
      effectiveAt: new Date("2026-03-01T09:00:00.000Z"),
    });

    const beforeEffective = await packsService.loadActiveCompiledPackForBook({
      bookId,
      at: new Date("2026-03-01T08:59:59.000Z"),
    });
    const afterEffective = await packsService.loadActiveCompiledPackForBook({
      bookId,
      at: new Date("2026-03-01T09:00:01.000Z"),
    });

    expect(beforeEffective.checksum).toBe(
      packsService.getDefaultCompiledPack().checksum,
    );
    expect(afterEffective.checksum).toBe(futureCompiled.checksum);
  });
});
