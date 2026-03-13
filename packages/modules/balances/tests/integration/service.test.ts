import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createIdempotencyService } from "@bedrock/adapter-idempotency-postgres";
import { schema as idempotencySchema } from "@bedrock/adapter-idempotency-postgres/schema";
import { schema as balancesSchema } from "@bedrock/balances/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";

import { createBalancesService } from "../../src/service";

const schema = {
  ...balancesSchema,
  ...ledgerSchema,
  ...idempotencySchema,
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
const idempotency = createIdempotencyService();
const balances = createBalancesService({ db, idempotency });
const createdBookIds = new Set<string>();
const createdIdempotencyKeys = new Set<string>();

function createSubject(bookId: string) {
  return {
    bookId,
    subjectType: "organization_requisite",
    subjectId: `org-req-${bookId.slice(0, 8)}`,
    currency: "USD",
  } as const;
}

async function seedBook(bookId: string) {
  createdBookIds.add(bookId);

  await db.insert(schema.books).values({
    id: bookId,
    organizationId: randomUUID(),
    code: `balances-it-${bookId}`,
    name: "Balances Integration Book",
    isDefault: false,
  });
}

async function seedBalancePosition(input: {
  bookId: string;
  subjectType: string;
  subjectId: string;
  currency: string;
  ledgerBalance?: bigint;
  available?: bigint;
  reserved?: bigint;
  pending?: bigint;
}) {
  await db.insert(schema.balancePositions).values({
    bookId: input.bookId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    currency: input.currency,
    ledgerBalance: input.ledgerBalance ?? 0n,
    available: input.available ?? 0n,
    reserved: input.reserved ?? 0n,
    pending: input.pending ?? 0n,
  });
}

async function cleanupRows() {
  const bookIds = Array.from(createdBookIds);
  const idempotencyKeys = Array.from(createdIdempotencyKeys);

  if (idempotencyKeys.length > 0) {
    await db
      .delete(schema.actionReceipts)
      .where(inArray(schema.actionReceipts.idempotencyKey, idempotencyKeys));
  }

  if (bookIds.length > 0) {
    await db
      .delete(schema.balanceEvents)
      .where(inArray(schema.balanceEvents.bookId, bookIds));
    await db
      .delete(schema.balanceHolds)
      .where(inArray(schema.balanceHolds.bookId, bookIds));
    await db
      .delete(schema.balancePositions)
      .where(inArray(schema.balancePositions.bookId, bookIds));
    await db.delete(schema.books).where(inArray(schema.books.id, bookIds));
  }

  createdBookIds.clear();
  createdIdempotencyKeys.clear();
}

describe("balances service integration", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  afterEach(async () => {
    await cleanupRows();
  });

  afterAll(async () => {
    await cleanupRows();
    await pool.end();
  });

  it("returns a zero snapshot for subjects that were never initialized", async () => {
    const bookId = randomUUID();

    await expect(balances.getBalance(createSubject(bookId))).resolves.toEqual({
      bookId,
      subjectType: "organization_requisite",
      subjectId: `org-req-${bookId.slice(0, 8)}`,
      currency: "USD",
      ledgerBalance: 0n,
      available: 0n,
      reserved: 0n,
      pending: 0n,
      version: 1,
    });
  });

  it("reserves balance once and replays the same result on duplicate idempotent calls", async () => {
    const bookId = randomUUID();
    const subject = createSubject(bookId);
    const idempotencyKey = `balances-reserve:${bookId}`;

    createdIdempotencyKeys.add(idempotencyKey);
    await seedBook(bookId);
    await seedBalancePosition({
      ...subject,
      ledgerBalance: 1_000n,
      available: 1_000n,
    });

    const first = await balances.reserve({
      subject,
      amountMinor: 250n,
      holdRef: "hold-1",
      reason: "invoice reserve",
      actorId: "user-1",
      idempotencyKey,
    });
    const replay = await balances.reserve({
      subject,
      amountMinor: 250n,
      holdRef: "hold-1",
      reason: "invoice reserve",
      actorId: "user-1",
      idempotencyKey,
    });

    expect(first.balance).toEqual({
      bookId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      currency: "USD",
      ledgerBalance: 1_000n,
      available: 750n,
      reserved: 250n,
      pending: 0n,
      version: 2,
    });
    expect(first.hold).toEqual(
      expect.objectContaining({
        holdRef: "hold-1",
        amountMinor: 250n,
        state: "active",
        reason: "invoice reserve",
      }),
    );
    expect(replay).toEqual(first);

    const events = await db
      .select({
        eventType: schema.balanceEvents.eventType,
        holdRef: schema.balanceEvents.holdRef,
      })
      .from(schema.balanceEvents)
      .where(eq(schema.balanceEvents.bookId, bookId));

    expect(events).toEqual([
      {
        eventType: "reserve",
        holdRef: "hold-1",
      },
    ]);
  });

  it("releases an active hold back into available balance", async () => {
    const bookId = randomUUID();
    const subject = createSubject(bookId);
    const reserveKey = `balances-reserve:${bookId}`;
    const releaseKey = `balances-release:${bookId}`;

    createdIdempotencyKeys.add(reserveKey);
    createdIdempotencyKeys.add(releaseKey);
    await seedBook(bookId);
    await seedBalancePosition({
      ...subject,
      ledgerBalance: 600n,
      available: 600n,
    });

    await balances.reserve({
      subject,
      amountMinor: 150n,
      holdRef: "hold-release",
      idempotencyKey: reserveKey,
    });

    const released = await balances.release({
      subject,
      holdRef: "hold-release",
      reason: "invoice cancelled",
      actorId: "user-2",
      idempotencyKey: releaseKey,
    });

    expect(released.balance).toEqual({
      bookId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      currency: "USD",
      ledgerBalance: 600n,
      available: 600n,
      reserved: 0n,
      pending: 0n,
      version: 3,
    });
    expect(released.hold).toEqual(
      expect.objectContaining({
        holdRef: "hold-release",
        state: "released",
        reason: "invoice cancelled",
      }),
    );
    expect(released.hold?.releasedAt).toBeInstanceOf(Date);
  });

  it("consumes an active hold into pending balance", async () => {
    const bookId = randomUUID();
    const subject = createSubject(bookId);
    const reserveKey = `balances-reserve:${bookId}`;
    const consumeKey = `balances-consume:${bookId}`;

    createdIdempotencyKeys.add(reserveKey);
    createdIdempotencyKeys.add(consumeKey);
    await seedBook(bookId);
    await seedBalancePosition({
      ...subject,
      ledgerBalance: 900n,
      available: 900n,
    });

    await balances.reserve({
      subject,
      amountMinor: 400n,
      holdRef: "hold-consume",
      idempotencyKey: reserveKey,
    });

    const consumed = await balances.consume({
      subject,
      holdRef: "hold-consume",
      reason: "payment sent",
      actorId: "user-3",
      idempotencyKey: consumeKey,
    });

    expect(consumed.balance).toEqual({
      bookId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      currency: "USD",
      ledgerBalance: 900n,
      available: 500n,
      reserved: 0n,
      pending: 400n,
      version: 3,
    });
    expect(consumed.hold).toEqual(
      expect.objectContaining({
        holdRef: "hold-consume",
        state: "consumed",
        reason: "payment sent",
      }),
    );
    expect(consumed.hold?.consumedAt).toBeInstanceOf(Date);
  });
});
