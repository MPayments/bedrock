import { and, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { LedgerError } from "../../../errors";
import { schema } from "../../../schema";
import type {
  EnsureDefaultOrganizationBookInput,
  LedgerBookStore,
} from "../../application/ports/book.store";

const DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX = "organization-default";

function buildDefaultOrganizationBookCode(organizationId: string): string {
  return `${DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX}:${organizationId}`;
}

function buildDefaultOrganizationBookName(organizationId: string): string {
  return `Organization ${organizationId} default book`;
}

export class DrizzleBooksStore implements LedgerBookStore {
  constructor(private readonly db: Queryable) {}

  async ensureDefaultOrganizationBook(
    input: EnsureDefaultOrganizationBookInput,
  ): Promise<{ bookId: string }> {
    const [defaultBook] = await this.db
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
    const [created] = await this.db
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

    const [byCode] = await this.db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.code, code))
      .limit(1);

    if (byCode) {
      return { bookId: byCode.id };
    }

    throw new LedgerError(
      `Failed to resolve default book for organization: ${input.organizationId}`,
    );
  }
}
