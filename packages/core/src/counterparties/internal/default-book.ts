import { and, eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/kernel/db/types";

import { schema as ledgerSchema } from "../../ledger/schema";
import { InternalLedgerInvariantViolationError } from "../errors";
import { assertInternalLedgerCounterparty } from "../internal-ledger";

const DEFAULT_BOOK_CODE_PREFIX = "counterparty-default";

function defaultBookCode(counterpartyId: string) {
  return `${DEFAULT_BOOK_CODE_PREFIX}:${counterpartyId}`;
}

function defaultBookName(counterpartyId: string) {
  return `Counterparty ${counterpartyId} default book`;
}

export async function ensureInternalLedgerDefaultBookIdTx(
  tx: Transaction,
  counterpartyId: string,
): Promise<string> {
  await assertInternalLedgerCounterparty({
    db: tx,
    counterpartyId,
  });

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

  const [existingNonDefaultBook] = await tx
    .select({ id: ledgerSchema.books.id })
    .from(ledgerSchema.books)
    .where(
      and(
        eq(ledgerSchema.books.counterpartyId, counterpartyId),
        eq(ledgerSchema.books.isDefault, false),
      ),
    )
    .limit(1);

  if (existingNonDefaultBook) {
    throw new InternalLedgerInvariantViolationError(
      `Internal counterparty ${counterpartyId} has no default book configured`,
    );
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

  throw new InternalLedgerInvariantViolationError(
    `Failed to resolve default book for counterparty: ${counterpartyId}`,
  );
}
