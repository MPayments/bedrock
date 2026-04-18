import type { LedgerBookRow } from "@bedrock/ledger/contracts";

export function relabelOrganizationBookNames(input: {
  books: LedgerBookRow[];
  organizationShortNamesById: Map<string, string>;
}): LedgerBookRow[] {
  return input.books.map((book) => {
    if (!book.name || !book.ownerId) {
      return book;
    }

    const shortName = input.organizationShortNamesById.get(book.ownerId);
    if (!shortName) {
      return book;
    }

    if (!book.name.includes(book.ownerId)) {
      return book;
    }

    return {
      ...book,
      name: book.name.replaceAll(book.ownerId, shortName),
    };
  });
}
