import { eq, inArray } from "drizzle-orm";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import type { Database, Transaction } from "@bedrock/persistence";

import {
  OrganizationInternalLedgerInvariantError,
  OrganizationNotFoundError,
} from "./errors";
import { schema } from "./schema";

type DbLike = Database | Transaction;

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export async function listInternalLedgerOrganizations(db: DbLike): Promise<
  {
    id: string;
    shortName: string;
  }[]
> {
  return db
    .select({
      id: schema.organizations.id,
      shortName: schema.organizations.shortName,
    })
    .from(schema.organizations)
    .orderBy(schema.organizations.shortName);
}

export async function isInternalLedgerOrganization(input: {
  db: DbLike;
  organizationId: string;
}): Promise<boolean> {
  const [organization] = await input.db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, input.organizationId))
    .limit(1);

  return Boolean(organization);
}

export async function assertInternalLedgerOrganization(input: {
  db: DbLike;
  organizationId: string;
}): Promise<void> {
  const exists = await isInternalLedgerOrganization(input);
  if (!exists) {
    throw new OrganizationNotFoundError(input.organizationId);
  }
}

export async function assertBooksBelongToInternalLedgerOrganizations(input: {
  db: DbLike;
  bookIds: string[];
}): Promise<void> {
  const bookIds = dedupeIds(input.bookIds);
  if (bookIds.length === 0) {
    return;
  }

  const rows = await input.db
    .select({
      bookId: ledgerSchema.books.id,
      organizationId: schema.organizations.id,
      ownerId: ledgerSchema.books.ownerId,
    })
    .from(ledgerSchema.books)
    .leftJoin(
      schema.organizations,
      eq(schema.organizations.id, ledgerSchema.books.ownerId),
    )
    .where(inArray(ledgerSchema.books.id, bookIds));

  const rowByBookId = new Map(rows.map((row) => [row.bookId, row]));

  for (const bookId of bookIds) {
    const row = rowByBookId.get(bookId);
    if (!row) {
      throw new OrganizationInternalLedgerInvariantError(
        `Ledger book does not exist: ${bookId}`,
      );
    }

    if (!row.organizationId) {
      throw new OrganizationInternalLedgerInvariantError(
        `Ledger book ${bookId} is owned by non-organization ${row.ownerId}`,
      );
    }
  }
}
