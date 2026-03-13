import { and, eq } from "drizzle-orm";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import type { Transaction } from "@bedrock/kernel/db/types";

const DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX = "organization-default";
const DEFAULT_COUNTERPARTY_BOOK_CODE_PREFIX = "counterparty-default";

function defaultOrganizationBookCode(organizationId: string) {
  return `${DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX}:${organizationId}`;
}

function defaultOrganizationBookName(organizationId: string) {
  return `Organization ${organizationId} default book`;
}

function defaultCounterpartyBookCode(counterpartyId: string) {
  return `${DEFAULT_COUNTERPARTY_BOOK_CODE_PREFIX}:${counterpartyId}`;
}

function defaultCounterpartyBookName(counterpartyId: string) {
  return `Counterparty ${counterpartyId} default book`;
}

export async function ensureOrganizationDefaultBookIdTx(
  tx: Transaction,
  organizationId: string,
): Promise<string> {
  const [defaultBook] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(
      and(
        eq(ledgerSchema.books.ownerId, organizationId),
        eq(ledgerSchema.books.isDefault, true),
      ),
    )
    .limit(1);

  if (defaultBook) {
    return defaultBook.id;
  }

  const code = defaultOrganizationBookCode(organizationId);
  const [created] = await tx
    .insert(ledgerSchema.books)
    .values({
      ownerId: organizationId,
      code,
      name: defaultOrganizationBookName(organizationId),
      isDefault: true,
    })
    .onConflictDoNothing({
      target: ledgerSchema.books.code,
    })
    .returning({ id: ledgerSchema.books.id });

  if (created) {
    return created.id;
  }

  const [byCode] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(eq(ledgerSchema.books.code, code))
    .limit(1);

  if (byCode) {
    return byCode.id;
  }

  throw new Error(
    `Failed to resolve default book for organization: ${organizationId}`,
  );
}

export async function ensureInternalLedgerDefaultBookIdTx(
  tx: Transaction,
  counterpartyId: string,
): Promise<string> {
  const [defaultBook] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(
      and(
        eq(ledgerSchema.books.ownerId, counterpartyId),
        eq(ledgerSchema.books.isDefault, true),
      ),
    )
    .limit(1);

  if (defaultBook) {
    return defaultBook.id;
  }

  const [existingNonDefaultBook] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(
      and(
        eq(ledgerSchema.books.ownerId, counterpartyId),
        eq(ledgerSchema.books.isDefault, false),
      ),
    )
    .limit(1);

  if (existingNonDefaultBook) {
    throw new Error(
      `Internal counterparty ${counterpartyId} has no default book configured`,
    );
  }

  const code = defaultCounterpartyBookCode(counterpartyId);
  const [created] = await tx
    .insert(ledgerSchema.books)
    .values({
      ownerId: counterpartyId,
      code,
      name: defaultCounterpartyBookName(counterpartyId),
      isDefault: true,
    })
    .onConflictDoNothing({
      target: ledgerSchema.books.code,
    })
    .returning({ id: ledgerSchema.books.id });

  if (created) {
    return created.id;
  }

  const [bookByCode] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(eq(ledgerSchema.books.code, code))
    .limit(1);

  if (bookByCode) {
    return bookByCode.id;
  }

  throw new Error(
    `Failed to resolve default book for counterparty: ${counterpartyId}`,
  );
}
