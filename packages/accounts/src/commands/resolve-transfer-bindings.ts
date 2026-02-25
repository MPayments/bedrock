import { eq, inArray, sql } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError } from "../errors";
import { ensureBookAccountTx } from "../internal/book-account";
import type { AccountServiceContext } from "../internal/context";
import {
  ResolveTransferBindingsInputSchema,
  type ResolveTransferBindingsInput,
  type TransferAccountBinding,
} from "../validation";

export function createResolveTransferBindingsHandler(context: AccountServiceContext) {
  const { db, log } = context;

  return async function resolveTransferBindings(
    input: ResolveTransferBindingsInput,
  ): Promise<TransferAccountBinding[]> {
    const validated = ResolveTransferBindingsInputSchema.parse(input);
    const uniqueAccountIds = [...new Set(validated.accountIds)];

    const rows = await db
      .select({
        accountId: schema.accounts.id,
        counterpartyId: schema.accounts.counterpartyId,
        currencyId: schema.accounts.currencyId,
        currencyCode: schema.currencies.code,
        stableKey: schema.accounts.stableKey,
        bookAccountId: schema.bookAccounts.id,
        bookAccountNo: schema.bookAccounts.accountNo,
      })
      .from(schema.accounts)
      .innerJoin(
        schema.currencies,
        eq(schema.accounts.currencyId, schema.currencies.id),
      )
      .leftJoin(
        schema.operationalAccountBindings,
        eq(schema.operationalAccountBindings.accountId, schema.accounts.id),
      )
      .leftJoin(
        schema.bookAccounts,
        eq(schema.bookAccounts.id, schema.operationalAccountBindings.bookAccountId),
      )
      .where(inArray(schema.accounts.id, uniqueAccountIds));

    if (rows.length !== uniqueAccountIds.length) {
      const foundIds = new Set(rows.map((row) => row.accountId));
      const missingId =
        uniqueAccountIds.find((id) => !foundIds.has(id)) ?? uniqueAccountIds[0]!;
      throw new AccountNotFoundError(missingId);
    }

    const unresolved = rows.filter((row) => !row.bookAccountId);

    if (unresolved.length > 0) {
      await db.transaction(async (tx) => {
        for (const row of unresolved) {
          const bookAccountId = await ensureBookAccountTx(tx, {
            orgId: row.counterpartyId,
            accountNo: ACCOUNT_NO.BANK,
            currency: row.currencyCode,
          });

          await tx
            .insert(schema.operationalAccountBindings)
            .values({
              accountId: row.accountId,
              bookAccountId,
            })
            .onConflictDoUpdate({
              target: schema.operationalAccountBindings.accountId,
              set: {
                bookAccountId,
                updatedAt: sql`now()`,
              },
            });
        }
      });
    }

    const refreshedRows = unresolved.length
      ? await db
          .select({
            accountId: schema.accounts.id,
            counterpartyId: schema.accounts.counterpartyId,
            currencyId: schema.accounts.currencyId,
            currencyCode: schema.currencies.code,
            stableKey: schema.accounts.stableKey,
            bookAccountId: schema.bookAccounts.id,
            bookAccountNo: schema.bookAccounts.accountNo,
          })
          .from(schema.accounts)
          .innerJoin(
            schema.currencies,
            eq(schema.accounts.currencyId, schema.currencies.id),
          )
          .innerJoin(
            schema.operationalAccountBindings,
            eq(schema.operationalAccountBindings.accountId, schema.accounts.id),
          )
          .innerJoin(
            schema.bookAccounts,
            eq(schema.bookAccounts.id, schema.operationalAccountBindings.bookAccountId),
          )
          .where(inArray(schema.accounts.id, uniqueAccountIds))
      : rows;

    const byAccountId = new Map<string, TransferAccountBinding>();

    for (const row of refreshedRows) {
      if (!row.bookAccountId || !row.bookAccountNo) {
        throw new Error(`Missing book account binding for account=${row.accountId}`);
      }

      byAccountId.set(row.accountId, {
        accountId: row.accountId,
        counterpartyId: row.counterpartyId,
        currencyId: row.currencyId,
        currencyCode: row.currencyCode,
        stableKey: row.stableKey,
        bookOrgId: row.counterpartyId,
        bookAccountId: row.bookAccountId,
        bookAccountNo: row.bookAccountNo,
      });
    }

    const orderedBindings = validated.accountIds.map((id) => byAccountId.get(id)!);

    log.debug("Resolved transfer account bindings", {
      requested: validated.accountIds.length,
      uniqueAccounts: uniqueAccountIds.length,
    });

    return orderedBindings;
  };
}
