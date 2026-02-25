import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import {
    AccountNotFoundError,
    AccountProviderNotFoundError,
} from "../errors";
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
                .from(schema.accounts)
                .where(eq(schema.accounts.id, id))
                .limit(1);

            if (!existing) {
                throw new AccountNotFoundError(id);
            }

            const [provider] = await tx
                .select()
                .from(schema.accountProviders)
                .where(eq(schema.accountProviders.id, existing.accountProviderId))
                .limit(1);

            if (!provider) {
                throw new AccountProviderNotFoundError(existing.accountProviderId);
            }

            const merged = {
                accountNo: validated.accountNo !== undefined ? validated.accountNo : existing.accountNo,
                corrAccount: validated.corrAccount !== undefined ? validated.corrAccount : existing.corrAccount,
                address: validated.address !== undefined ? validated.address : existing.address,
            };

            validateAccountFieldsForProvider(merged, provider);

            const fields: Record<string, unknown> = {};

            if (validated.label !== undefined) fields.label = validated.label;
            if (validated.description !== undefined) fields.description = validated.description;
            if (validated.accountNo !== undefined) fields.accountNo = validated.accountNo;
            if (validated.corrAccount !== undefined) fields.corrAccount = validated.corrAccount;
            if (validated.address !== undefined) fields.address = validated.address;
            if (validated.iban !== undefined) fields.iban = validated.iban;

            if (Object.keys(fields).length === 0) {
                return existing;
            }

            fields.updatedAt = sql`now()`;

            const [updated] = await tx
                .update(schema.accounts)
                .set(fields)
                .where(eq(schema.accounts.id, id))
                .returning();

            log.info("Account updated", { id });

            return updated!;
        });
    };
}
