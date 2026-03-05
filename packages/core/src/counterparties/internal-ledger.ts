import { eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/kernel/db/types";

import {
  CounterpartyNotInternalLedgerEntityError,
  InternalLedgerInvariantViolationError,
} from "./errors";
import {
  dedupeIds,
  TREASURY_INTERNAL_LEDGER_GROUP_CODE,
} from "./internal/shared-group-rules";
import { schema } from "./schema";

type DbLike = Database | Transaction;

export async function listInternalLedgerCounterparties(db: DbLike): Promise<
  {
    id: string;
    shortName: string;
  }[]
> {
  const result = await db.execute(sql`
    WITH RECURSIVE internal_groups AS (
      SELECT id
      FROM counterparty_groups
      WHERE code = ${TREASURY_INTERNAL_LEDGER_GROUP_CODE}
      UNION ALL
      SELECT child.id
      FROM counterparty_groups child
      INNER JOIN internal_groups ig ON child.parent_id = ig.id
    )
    SELECT DISTINCT
      c.id::text AS id,
      c.short_name
    FROM counterparties c
    INNER JOIN counterparty_group_memberships m
      ON m.counterparty_id = c.id
    INNER JOIN internal_groups ig
      ON ig.id = m.group_id
    ORDER BY c.short_name ASC
  `);

  const rows = (result.rows ?? []) as {
    id: string;
    short_name: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    shortName: row.short_name,
  }));
}

export async function isInternalLedgerCounterparty(input: {
  db: DbLike;
  counterpartyId: string;
  at?: Date;
}): Promise<boolean> {
  const result = await input.db.execute(sql`
    WITH RECURSIVE internal_groups AS (
      SELECT id
      FROM counterparty_groups
      WHERE code = ${TREASURY_INTERNAL_LEDGER_GROUP_CODE}
      UNION ALL
      SELECT child.id
      FROM counterparty_groups child
      INNER JOIN internal_groups ig ON child.parent_id = ig.id
    )
    SELECT 1 AS one
    FROM counterparty_group_memberships m
    INNER JOIN internal_groups ig
      ON ig.id = m.group_id
    WHERE m.counterparty_id = ${input.counterpartyId}::uuid
    LIMIT 1
  `);

  const rows = (result.rows ?? []) as { one: number }[];
  return rows.length > 0;
}

export async function assertInternalLedgerCounterparty(input: {
  db: DbLike;
  counterpartyId: string;
  at?: Date;
}): Promise<void> {
  const isInternal = await isInternalLedgerCounterparty(input);
  if (!isInternal) {
    throw new CounterpartyNotInternalLedgerEntityError(input.counterpartyId);
  }
}

export async function assertBooksBelongToInternalLedgerCounterparties(input: {
  db: DbLike;
  bookIds: string[];
}): Promise<void> {
  const bookIds = dedupeIds(input.bookIds);
  if (bookIds.length === 0) {
    return;
  }

  const result = await input.db.execute(sql`
    WITH RECURSIVE internal_groups AS (
      SELECT id
      FROM counterparty_groups
      WHERE code = ${TREASURY_INTERNAL_LEDGER_GROUP_CODE}
      UNION ALL
      SELECT child.id
      FROM counterparty_groups child
      INNER JOIN internal_groups ig ON child.parent_id = ig.id
    ),
    internal_counterparties AS (
      SELECT DISTINCT m.counterparty_id
      FROM counterparty_group_memberships m
      INNER JOIN internal_groups ig ON ig.id = m.group_id
    )
    SELECT
      b.id::text AS book_id,
      b.counterparty_id::text AS counterparty_id,
      CASE WHEN ic.counterparty_id IS NULL THEN false ELSE true END AS is_internal
    FROM books b
    LEFT JOIN internal_counterparties ic
      ON ic.counterparty_id = b.counterparty_id
    WHERE b.id IN (${sql.join(
      bookIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);

  const rows = (result.rows ?? []) as {
    book_id: string;
    counterparty_id: string | null;
    is_internal: boolean;
  }[];

  const rowByBookId = new Map(rows.map((row) => [row.book_id, row]));

  for (const bookId of bookIds) {
    const row = rowByBookId.get(bookId);
    if (!row) {
      throw new InternalLedgerInvariantViolationError(
        `Ledger book does not exist: ${bookId}`,
      );
    }

    if (!row.counterparty_id) {
      throw new InternalLedgerInvariantViolationError(
        `Ledger book ${bookId} has no owner counterparty`,
      );
    }

    if (!row.is_internal) {
      throw new CounterpartyNotInternalLedgerEntityError(row.counterparty_id);
    }
  }
}

export async function assertInternalLedgerInvariants(
  db: DbLike,
): Promise<void> {
  const [internalRoot] = await db
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(
      eq(schema.counterpartyGroups.code, TREASURY_INTERNAL_LEDGER_GROUP_CODE),
    )
    .limit(1);

  if (!internalRoot) {
    throw new InternalLedgerInvariantViolationError(
      `Internal ledger group is not configured: ${TREASURY_INTERNAL_LEDGER_GROUP_CODE}`,
    );
  }

  const invalidBookResult = await db.execute(sql`
    WITH RECURSIVE internal_groups AS (
      SELECT id
      FROM counterparty_groups
      WHERE code = ${TREASURY_INTERNAL_LEDGER_GROUP_CODE}
      UNION ALL
      SELECT child.id
      FROM counterparty_groups child
      INNER JOIN internal_groups ig ON child.parent_id = ig.id
    ),
    internal_counterparties AS (
      SELECT DISTINCT m.counterparty_id
      FROM counterparty_group_memberships m
      INNER JOIN internal_groups ig ON ig.id = m.group_id
    )
    SELECT
      b.id::text AS book_id,
      b.counterparty_id::text AS counterparty_id
    FROM books b
    LEFT JOIN internal_counterparties ic
      ON ic.counterparty_id = b.counterparty_id
    WHERE b.counterparty_id IS NULL OR ic.counterparty_id IS NULL
    LIMIT 1
  `);

  const invalidBooks = (invalidBookResult.rows ?? []) as {
    book_id: string;
    counterparty_id: string | null;
  }[];
  const invalidBook = invalidBooks[0];
  if (invalidBook) {
    throw new InternalLedgerInvariantViolationError(
      `Book ${invalidBook.book_id} is owned by non-internal counterparty ${invalidBook.counterparty_id ?? "null"}`,
    );
  }

  const defaultBookCheckResult = await db.execute(sql`
    WITH RECURSIVE internal_groups AS (
      SELECT id
      FROM counterparty_groups
      WHERE code = ${TREASURY_INTERNAL_LEDGER_GROUP_CODE}
      UNION ALL
      SELECT child.id
      FROM counterparty_groups child
      INNER JOIN internal_groups ig ON child.parent_id = ig.id
    ),
    internal_counterparties AS (
      SELECT DISTINCT m.counterparty_id
      FROM counterparty_group_memberships m
      INNER JOIN internal_groups ig ON ig.id = m.group_id
    ),
    default_counts AS (
      SELECT
        b.counterparty_id,
        COUNT(*) FILTER (WHERE b.is_default = true)::int AS default_count
      FROM books b
      GROUP BY b.counterparty_id
    )
    SELECT
      ic.counterparty_id::text AS counterparty_id,
      COALESCE(dc.default_count, 0)::int AS default_count
    FROM internal_counterparties ic
    LEFT JOIN default_counts dc
      ON dc.counterparty_id = ic.counterparty_id
    WHERE COALESCE(dc.default_count, 0) <> 1
    LIMIT 1
  `);

  const invalidDefaults = (defaultBookCheckResult.rows ?? []) as {
    counterparty_id: string;
    default_count: number;
  }[];
  const invalidDefault = invalidDefaults[0];
  if (invalidDefault) {
    throw new InternalLedgerInvariantViolationError(
      `Internal counterparty ${invalidDefault.counterparty_id} must have exactly one default book, got ${invalidDefault.default_count}`,
    );
  }
}
