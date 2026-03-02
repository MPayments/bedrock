import { eq } from "drizzle-orm";

import { ensureBookAccountInstanceTx } from "@bedrock/core/ledger";
import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";
import {
  CreateAccountInputSchema,
  validateAccountFieldsForProvider,
  type CreateAccountInput,
} from "../validation";

export function createCreateCounterpartyAccountHandler(
  context: CounterpartyAccountsServiceContext,
) {
  const { db, log } = context;

  return async function createAccount(input: CreateAccountInput) {
    const validated = CreateAccountInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [provider] = await tx
        .select()
        .from(schema.counterpartyAccountProviders)
        .where(
          eq(
            schema.counterpartyAccountProviders.id,
            validated.accountProviderId,
          ),
        )
        .limit(1);

      if (!provider) {
        throw new AccountProviderNotFoundError(validated.accountProviderId);
      }

      validateAccountFieldsForProvider(validated, provider);

      const [created] = await tx
        .insert(schema.counterpartyAccounts)
        .values({
          counterpartyId: validated.counterpartyId,
          currencyId: validated.currencyId,
          accountProviderId: validated.accountProviderId,
          label: validated.label,
          description: validated.description ?? null,
          stableKey: validated.stableKey,
          accountNo: validated.accountNo ?? null,
          corrAccount: validated.corrAccount ?? null,
          address: validated.address ?? null,
          iban: validated.iban ?? null,
        })
        .returning();

      const [currency] = await tx
        .select({ code: schema.currencies.code })
        .from(schema.currencies)
        .where(eq(schema.currencies.id, validated.currencyId))
        .limit(1);

      if (!currency) {
        throw new Error(`Currency not found: ${validated.currencyId}`);
      }

      const { id: bookAccountInstanceId } = await ensureBookAccountInstanceTx(
        tx,
        {
          bookId: validated.counterpartyId,
          accountNo: validated.postingAccountNo,
          currency: currency.code,
          dimensions: {},
        },
      );

      await tx
        .insert(schema.counterpartyAccountBindings)
        .values({
          counterpartyAccountId: created!.id,
          bookId: validated.counterpartyId,
          bookAccountInstanceId,
        })
        .onConflictDoUpdate({
          target: schema.counterpartyAccountBindings.counterpartyAccountId,
          set: {
            bookId: validated.counterpartyId,
            bookAccountInstanceId,
          },
        });

      log.info("Account created", { id: created!.id, label: created!.label });

      return {
        ...created!,
        bookId: validated.counterpartyId,
        postingAccountNo: validated.postingAccountNo,
      };
    });
  };
}
