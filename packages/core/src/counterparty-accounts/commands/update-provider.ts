import { eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountProviderNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";
import {
  UpdateProviderInputSchema,
  validateMergedProviderState,
  type UpdateProviderInput,
} from "../validation";

export function createUpdateProviderHandler(context: CounterpartyAccountsServiceContext) {
  const { db, log } = context;

  return async function updateProvider(id: string, input: UpdateProviderInput) {
    const validated = UpdateProviderInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.counterpartyAccountProviders)
        .where(eq(schema.counterpartyAccountProviders.id, id))
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
      if (validated.description !== undefined) {
        fields.description = validated.description;
      }
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
        .update(schema.counterpartyAccountProviders)
        .set(fields)
        .where(eq(schema.counterpartyAccountProviders.id, id))
        .returning();

      log.info("Account provider updated", { id });

      return updated!;
    });
  };
}
