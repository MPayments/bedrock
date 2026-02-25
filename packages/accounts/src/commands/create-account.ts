import { eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";
import {
    CreateAccountInputSchema,
    validateAccountFieldsForProvider,
    type CreateAccountInput,
} from "../validation";

export function createCreateAccountHandler(context: AccountServiceContext) {
    const { db, log } = context;

    return async function createAccount(input: CreateAccountInput) {
        const validated = CreateAccountInputSchema.parse(input);

        return db.transaction(async (tx) => {
            const [provider] = await tx
                .select()
                .from(schema.accountProviders)
                .where(eq(schema.accountProviders.id, validated.accountProviderId))
                .limit(1);

            if (!provider) {
                throw new AccountProviderNotFoundError(validated.accountProviderId);
            }

            validateAccountFieldsForProvider(validated, provider);

            const [created] = await tx
                .insert(schema.accounts)
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

            log.info("Account created", { id: created!.id, label: created!.label });

            return created!;
        });
    };
}
