import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";
import {
    UpdateProviderInputSchema,
    validateMergedProviderState,
    type UpdateProviderInput,
} from "../validation";

export function createUpdateProviderHandler(context: AccountServiceContext) {
    const { db, log } = context;

    return async function updateProvider(id: string, input: UpdateProviderInput) {
        const validated = UpdateProviderInputSchema.parse(input);

        return db.transaction(async (tx) => {
            const [existing] = await tx
                .select()
                .from(schema.accountProviders)
                .where(eq(schema.accountProviders.id, id))
                .limit(1);

            if (!existing) {
                throw new AccountProviderNotFoundError(id);
            }

            const merged = {
                type: existing.type,
                country: validated.country ?? existing.country,
                bic: validated.bic !== undefined ? validated.bic : existing.bic,
                swift: validated.swift !== undefined ? validated.swift : existing.swift,
            };

            validateMergedProviderState(merged);

            const fields: Record<string, unknown> = {};

            if (validated.name !== undefined) fields.name = validated.name;
            if (validated.country !== undefined) fields.country = validated.country;
            if (validated.address !== undefined) fields.address = validated.address;
            if (validated.contact !== undefined) fields.contact = validated.contact;
            if (validated.bic !== undefined) fields.bic = validated.bic;
            if (validated.swift !== undefined) fields.swift = validated.swift;

            if (Object.keys(fields).length === 0) {
                return existing;
            }

            fields.updatedAt = sql`now()`;

            const [updated] = await tx
                .update(schema.accountProviders)
                .set(fields)
                .where(eq(schema.accountProviders.id, id))
                .returning();

            log.info("Account provider updated", { id });

            return updated!;
        });
    };
}
