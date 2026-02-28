import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { schema } from "@bedrock/db/schema";
import { rawPackDefinition } from "@bedrock/pack-bedrock-core-default";

import { createAccountingRuntime } from "../../src/runtime";

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

async function cleanupCreatedBooks() {
  const bookIds = Array.from(createdBookIds);
  if (bookIds.length === 0) {
    return;
  }

  await db
    .delete(schema.accountingPackAssignments)
    .where(inArray(schema.accountingPackAssignments.scopeId, bookIds));
  await db.delete(schema.books).where(inArray(schema.books.id, bookIds));
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
    const runtime = createAccountingRuntime({
      db,
      defaultPackDefinition: rawPackDefinition,
    });
    const bookId = randomUUID();
    createdBookIds.add(bookId);

    await db.insert(schema.books).values({
      id: bookId,
      code: `it-pack-${bookId}`,
      name: "Integration Pack Book",
      isDefault: false,
    });

    const compiled = await runtime.storeCompiledPackVersion({
      definition: rawPackDefinition,
    });
    const effectiveAt = new Date("2026-02-28T09:00:00.000Z");

    await runtime.activatePackForScope({
      scopeId: bookId,
      packChecksum: compiled.checksum,
      effectiveAt,
    });

    const loaded = await runtime.loadActiveCompiledPackForBook({
      bookId,
      at: new Date("2026-02-28T10:00:00.000Z"),
    });

    expect(loaded.checksum).toBe(compiled.checksum);

    const [assignment] = await db
      .select()
      .from(schema.accountingPackAssignments)
      .where(eq(schema.accountingPackAssignments.scopeId, bookId))
      .limit(1);

    expect(assignment).toEqual(
      expect.objectContaining({
        scopeType: "book",
        scopeId: bookId,
        packChecksum: compiled.checksum,
      }),
    );
  });
});
