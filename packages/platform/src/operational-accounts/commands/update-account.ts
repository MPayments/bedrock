import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema/operational-accounts";
import { ACCOUNT_NO } from "@bedrock/platform/accounting";
import { ensureBookAccountInstanceTx } from "@bedrock/platform/ledger";

import { AccountNotFoundError, AccountProviderNotFoundError } from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";
import {
  UpdateAccountInputSchema,
  validateAccountFieldsForProvider,
  type UpdateAccountInput,
} from "../validation";

export function createUpdateOperationalAccountHandler(
  context: OperationalAccountsServiceContext,
) {
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
        const { id: bookAccountInstanceId } = await ensureBookAccountInstanceTx(
          tx,
          {
            bookId: existing.counterpartyId,
            accountNo: validated.postingAccountNo,
            currency: currency.code,
            dimensions: {},
          },
        );

        await tx
          .insert(schema.operationalAccountBindings)
          .values({
            operationalAccountId: id,
            bookId: existing.counterpartyId,
            bookAccountInstanceId,
          })
          .onConflictDoUpdate({
            target: schema.operationalAccountBindings.operationalAccountId,
            set: {
              bookId: existing.counterpartyId,
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
        bookId: existing.counterpartyId,
        postingAccountNo: binding?.postingAccountNo ?? ACCOUNT_NO.BANK,
      };
    });
  };
}
