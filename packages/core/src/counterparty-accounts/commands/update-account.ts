import { eq, sql } from "drizzle-orm";

import { ensureBookAccountInstanceTx } from "@bedrock/core/ledger";
import { schema } from "@bedrock/core/counterparty-accounts/schema";

import {
  AccountBindingNotFoundError,
  AccountNotFoundError,
  AccountProviderNotFoundError,
} from "../errors";
import { ensureCounterpartyDefaultBookIdTx } from "../internal/books";
import type { CounterpartyAccountsServiceContext } from "../internal/context";
import {
  UpdateAccountInputSchema,
  validateAccountFieldsForProvider,
  type UpdateAccountInput,
} from "../validation";

export function createUpdateCounterpartyAccountHandler(
  context: CounterpartyAccountsServiceContext,
) {
  const { db, log } = context;

  return async function updateAccount(id: string, input: UpdateAccountInput) {
    const validated = UpdateAccountInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.counterpartyAccounts)
        .where(eq(schema.counterpartyAccounts.id, id))
        .limit(1);

      if (!existing) {
        throw new AccountNotFoundError(id);
      }

      const [provider] = await tx
        .select()
        .from(schema.counterpartyAccountProviders)
        .where(
          eq(schema.counterpartyAccountProviders.id, existing.accountProviderId),
        )
        .limit(1);

      if (!provider) {
        throw new AccountProviderNotFoundError(existing.accountProviderId);
      }

      const merged = {
        accountNo:
          validated.accountNo !== undefined
            ? validated.accountNo
            : existing.accountNo,
        corrAccount:
          validated.corrAccount !== undefined
            ? validated.corrAccount
            : existing.corrAccount,
        address:
          validated.address !== undefined
            ? validated.address
            : existing.address,
      };

      validateAccountFieldsForProvider(merged, provider);

      const [currency] = await tx
        .select({ code: schema.currencies.code })
        .from(schema.currencies)
        .where(eq(schema.currencies.id, existing.currencyId))
        .limit(1);

      if (!currency) {
        throw new Error(`Currency not found: ${existing.currencyId}`);
      }

      const fields: Record<string, unknown> = {};

      if (validated.label !== undefined) fields.label = validated.label;
      if (validated.description !== undefined) {
        fields.description = validated.description;
      }
      if (validated.accountNo !== undefined) {
        fields.accountNo = validated.accountNo;
      }
      if (validated.corrAccount !== undefined) {
        fields.corrAccount = validated.corrAccount;
      }
      if (validated.address !== undefined) fields.address = validated.address;
      if (validated.iban !== undefined) fields.iban = validated.iban;

      let updatedAccount = existing;

      if (Object.keys(fields).length > 0) {
        fields.updatedAt = sql`now()`;

        const [updated] = await tx
          .update(schema.counterpartyAccounts)
          .set(fields)
          .where(eq(schema.counterpartyAccounts.id, id))
          .returning();

        updatedAccount = updated!;
      }

      if (validated.postingAccountNo !== undefined) {
        const bookId = await ensureCounterpartyDefaultBookIdTx(
          tx,
          existing.counterpartyId,
        );
        const { id: bookAccountInstanceId } = await ensureBookAccountInstanceTx(
          tx,
          {
            bookId,
            accountNo: validated.postingAccountNo,
            currency: currency.code,
            dimensions: {},
          },
        );

        await tx
          .insert(schema.counterpartyAccountBindings)
          .values({
            counterpartyAccountId: id,
            bookId,
            bookAccountInstanceId,
          })
          .onConflictDoUpdate({
            target: schema.counterpartyAccountBindings.counterpartyAccountId,
            set: {
              bookId,
              bookAccountInstanceId,
              updatedAt: sql`now()`,
            },
          });
      }

      const [binding] = await tx
        .select({
          bookId: schema.counterpartyAccountBindings.bookId,
          postingAccountNo: schema.bookAccountInstances.accountNo,
        })
        .from(schema.counterpartyAccountBindings)
        .innerJoin(
          schema.bookAccountInstances,
          eq(
            schema.bookAccountInstances.id,
            schema.counterpartyAccountBindings.bookAccountInstanceId,
          ),
        )
        .where(eq(schema.counterpartyAccountBindings.counterpartyAccountId, id))
        .limit(1);

      if (!binding?.postingAccountNo) {
        throw new AccountBindingNotFoundError(id);
      }

      log.info("Account updated", { id });

      return {
        id: updatedAccount.id,
        counterpartyId: updatedAccount.counterpartyId,
        bookId: binding.bookId,
        currencyId: updatedAccount.currencyId,
        accountProviderId: updatedAccount.accountProviderId,
        label: updatedAccount.label,
        description: updatedAccount.description,
        accountNo: updatedAccount.accountNo,
        corrAccount: updatedAccount.corrAccount,
        address: updatedAccount.address,
        iban: updatedAccount.iban,
        postingAccountNo: binding.postingAccountNo,
        createdAt: updatedAccount.createdAt,
        updatedAt: updatedAccount.updatedAt,
      };
    });
  };
}
