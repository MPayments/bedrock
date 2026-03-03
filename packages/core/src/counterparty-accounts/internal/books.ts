import { and, asc, eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/kernel/db/types";
import { schema as ledgerSchema } from "@bedrock/core/ledger/schema";

const DEFAULT_BOOK_CODE_PREFIX = "counterparty-default";

function defaultBookCode(counterpartyId: string) {
  return `${DEFAULT_BOOK_CODE_PREFIX}:${counterpartyId}`;
}

function defaultBookName(counterpartyId: string) {
  return `Counterparty ${counterpartyId} default book`;
}

export async function ensureCounterpartyDefaultBookIdTx(
  tx: Transaction,
  counterpartyId: string,
): Promise<string> {
  const [defaultBook] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(
      and(
        eq(ledgerSchema.books.counterpartyId, counterpartyId),
        eq(ledgerSchema.books.isDefault, true),
      ),
    )
    .limit(1);

  if (defaultBook) {
    return defaultBook.id;
  }

  const [firstBook] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(eq(ledgerSchema.books.counterpartyId, counterpartyId))
    .orderBy(asc(ledgerSchema.books.createdAt))
    .limit(1);

  if (firstBook) {
    return firstBook.id;
  }

  const code = defaultBookCode(counterpartyId);
  const [created] = await tx
    .insert(ledgerSchema.books)
    .values({
      counterpartyId,
      code,
      name: defaultBookName(counterpartyId),
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

  throw new Error(`Failed to resolve default book for counterparty: ${counterpartyId}`);
}
