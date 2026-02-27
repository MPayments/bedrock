import { eq } from "drizzle-orm";

import { ensureBookAccountInstanceTx } from "@bedrock/book-accounts";
import { schema } from "@bedrock/db/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";
import {
  CreateAccountInputSchema,
  validateAccountFieldsForProvider,
  type CreateAccountInput,
} from "../validation";

export function createCreateOperationalAccountHandler(
  context: OperationalAccountsServiceContext,
) {
  const { db, log } = context;

  return async function createAccount(input: CreateAccountInput) {
    const validated = CreateAccountInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [provider] = await tx
        .select()
        .from(schema.operationalAccountProviders)
        .where(
          eq(
            schema.operationalAccountProviders.id,
            validated.accountProviderId,
          ),
        )
        .limit(1);

      if (!provider) {
        throw new AccountProviderNotFoundError(validated.accountProviderId);
      }

      validateAccountFieldsForProvider(validated, provider);

      const [created] = await tx
        .insert(schema.operationalAccounts)
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
        bookOrgId: validated.counterpartyId,
        accountNo: validated.postingAccountNo,
        currency: currency.code,
        dimensions: {},
        },
      );

      await tx
        .insert(schema.operationalAccountBindings)
        .values({
          operationalAccountId: created!.id,
          bookAccountInstanceId,
        })
        .onConflictDoUpdate({
          target: schema.operationalAccountBindings.operationalAccountId,
          set: {
            bookAccountInstanceId,
          },
        });

      log.info("Account created", { id: created!.id, label: created!.label });

      return {
        ...created!,
        postingAccountNo: validated.postingAccountNo,
      };
    });
  };
}
