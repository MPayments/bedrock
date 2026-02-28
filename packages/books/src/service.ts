import { and, asc, desc, eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { BookNotFoundError } from "./errors";
import {
  createBooksServiceContext,
  type BooksServiceDeps,
} from "./internal/context";
import {
  CreateBookInputSchema,
  ListBooksByCounterpartyInputSchema,
  ResolveOperationalAccountBookInputSchema,
} from "./validation";

export type BooksService = ReturnType<typeof createBooksService>;

export function createBooksService(deps: BooksServiceDeps) {
  const context = createBooksServiceContext(deps);
  const { db, log } = context;

  async function createBook(input: {
    counterpartyId?: string | null;
    code: string;
    name: string;
    isDefault?: boolean;
  }) {
    const validated = CreateBookInputSchema.parse(input);
    const [created] = await db
      .insert(schema.books)
      .values({
        counterpartyId: validated.counterpartyId ?? null,
        code: validated.code,
        name: validated.name,
        isDefault: validated.isDefault ?? false,
      })
      .returning();

    log.info("Book created", { id: created!.id, code: created!.code });
    return created!;
  }

  async function getBook(bookId: string) {
    const [book] = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);

    if (!book) {
      throw new BookNotFoundError(bookId);
    }

    return book;
  }

  async function listBooksByCounterparty(input: { counterpartyId: string }) {
    const validated = ListBooksByCounterpartyInputSchema.parse(input);
    return db
      .select()
      .from(schema.books)
      .where(eq(schema.books.counterpartyId, validated.counterpartyId))
      .orderBy(desc(schema.books.isDefault), asc(schema.books.createdAt));
  }

  async function resolveBookForOperationalAccount(input: {
    operationalAccountId: string;
  }) {
    const validated = ResolveOperationalAccountBookInputSchema.parse(input);

    const [row] = await db
      .select({
        id: schema.books.id,
        counterpartyId: schema.books.counterpartyId,
        code: schema.books.code,
        name: schema.books.name,
        isDefault: schema.books.isDefault,
        createdAt: schema.books.createdAt,
        updatedAt: schema.books.updatedAt,
      })
      .from(schema.operationalAccountBindings)
      .innerJoin(
        schema.books,
        eq(schema.books.id, schema.operationalAccountBindings.bookId),
      )
      .where(
        eq(
          schema.operationalAccountBindings.operationalAccountId,
          validated.operationalAccountId,
        ),
      )
      .limit(1);

    if (row) {
      return row;
    }

    const [fallback] = await db
      .select({
        id: schema.books.id,
        counterpartyId: schema.books.counterpartyId,
        code: schema.books.code,
        name: schema.books.name,
        isDefault: schema.books.isDefault,
        createdAt: schema.books.createdAt,
        updatedAt: schema.books.updatedAt,
      })
      .from(schema.operationalAccounts)
      .innerJoin(
        schema.books,
        and(
          eq(schema.books.id, schema.operationalAccounts.counterpartyId),
          eq(schema.books.counterpartyId, schema.operationalAccounts.counterpartyId),
        ),
      )
      .where(eq(schema.operationalAccounts.id, validated.operationalAccountId))
      .limit(1);

    if (!fallback) {
      throw new BookNotFoundError(validated.operationalAccountId);
    }

    return fallback;
  }

  return {
    createBook,
    getBook,
    listBooksByCounterparty,
    resolveBookForOperationalAccount,
  };
}
