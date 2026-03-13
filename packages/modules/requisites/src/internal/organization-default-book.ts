import { and, eq } from "drizzle-orm";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import type { Transaction } from "@bedrock/persistence";

const DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX = "organization-default";

function defaultOrganizationBookCode(organizationId: string) {
  return `${DEFAULT_ORGANIZATION_BOOK_CODE_PREFIX}:${organizationId}`;
}

function defaultOrganizationBookName(organizationId: string) {
  return `Organization ${organizationId} default book`;
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
