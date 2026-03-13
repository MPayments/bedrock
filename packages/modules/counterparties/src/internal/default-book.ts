import { and, eq } from "drizzle-orm";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import type { Transaction } from "@bedrock/adapter-db-drizzle/db/types";

const DEFAULT_COUNTERPARTY_BOOK_CODE_PREFIX = "counterparty-default";

function defaultCounterpartyBookCode(counterpartyId: string) {
  return `${DEFAULT_COUNTERPARTY_BOOK_CODE_PREFIX}:${counterpartyId}`;
}

function defaultCounterpartyBookName(counterpartyId: string) {
  return `Counterparty ${counterpartyId} default book`;
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
