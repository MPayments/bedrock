import { eq, sql } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError, AccountProviderNotFoundError } from "../errors";
import { ensureBookAccountInstanceTx } from "../internal/book-account";
import type { AccountServiceContext } from "../internal/context";
import {
  UpdateAccountInputSchema,
  validateAccountFieldsForProvider,
  type UpdateAccountInput,
} from "../validation";

export function createUpdateAccountHandler(context: AccountServiceContext) {
  const { db, log } = context;

  return async function updateAccount(id: string, input: UpdateAccountInput) {
    const validated = UpdateAccountInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.operationalAccounts)
        .where(eq(schema.operationalAccounts.id, id))
        .limit(1);

      if (!existing) {
        throw new AccountNotFoundError(id);
      }

      const [provider] = await tx
        .select()
        .from(schema.operationalAccountProviders)
        .where(
          eq(schema.operationalAccountProviders.id, existing.accountProviderId),
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
          .update(schema.operationalAccounts)
          .set(fields)
          .where(eq(schema.operationalAccounts.id, id))
          .returning();

        updatedAccount = updated!;
      }

      if (validated.postingAccountNo !== undefined) {
        const bookAccountInstanceId = await ensureBookAccountInstanceTx(tx, {
          bookOrgId: existing.counterpartyId,
          accountNo: validated.postingAccountNo,
          currency: currency.code,
          dimensions: {},
        });

        await tx
          .insert(schema.operationalAccountBindings)
          .values({
            operationalAccountId: id,
            bookAccountInstanceId,
          })
          .onConflictDoUpdate({
            target: schema.operationalAccountBindings.operationalAccountId,
            set: {
              bookAccountInstanceId,
              updatedAt: sql`now()`,
            },
          });
      }

      const [binding] = await tx
        .select({ postingAccountNo: schema.bookAccountInstances.accountNo })
        .from(schema.operationalAccountBindings)
        .innerJoin(
          schema.bookAccountInstances,
          eq(
            schema.bookAccountInstances.id,
            schema.operationalAccountBindings.bookAccountInstanceId,
          ),
        )
        .where(eq(schema.operationalAccountBindings.operationalAccountId, id))
        .limit(1);

      log.info("Account updated", { id });

      return {
        ...updatedAccount,
        postingAccountNo: binding?.postingAccountNo ?? ACCOUNT_NO.BANK,
      };
    });
  };
}
