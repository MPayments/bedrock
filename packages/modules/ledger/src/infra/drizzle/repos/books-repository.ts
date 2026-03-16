import { and, eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { LedgerBooksPort } from "../../../application/books/ports";
import { schema } from "../schema";

const DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX = "organization-default";

function buildDefaultOrganizationBookCode(organizationId: string): string {
  return `${DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX}:${organizationId}`;
}

function buildDefaultOrganizationBookName(organizationId: string): string {
  return `Organization ${organizationId} default book`;
}

export function createDrizzleLedgerBooksRepository(): LedgerBooksPort {
  return {
    async ensureDefaultOrganizationBookTx(
      tx: PersistenceSession,
      input: { organizationId: string },
    ) {
      const transaction = tx as Transaction;
      const [defaultBook] = await transaction
        .select({ id: schema.books.id })
        .from(schema.books)
        .where(
          and(
            eq(schema.books.ownerId, input.organizationId),
            eq(schema.books.isDefault, true),
          ),
        )
        .limit(1);

      if (defaultBook) {
        return { bookId: defaultBook.id };
      }

      const code = buildDefaultOrganizationBookCode(input.organizationId);
      const [created] = await transaction
        .insert(schema.books)
        .values({
          ownerId: input.organizationId,
          code,
          name: buildDefaultOrganizationBookName(input.organizationId),
          isDefault: true,
        })
        .onConflictDoNothing({
          target: schema.books.code,
        })
        .returning({ id: schema.books.id });

      if (created) {
        return { bookId: created.id };
      }

      const [byCode] = await transaction
        .select({ id: schema.books.id })
        .from(schema.books)
        .where(eq(schema.books.code, code))
        .limit(1);

      if (byCode) {
        return { bookId: byCode.id };
      }

      throw new Error(
        `Failed to resolve default book for organization: ${input.organizationId}`,
      );
    },
  };
}
