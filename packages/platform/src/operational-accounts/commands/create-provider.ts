import { schema } from "@bedrock/db/schema/operational-accounts";

import type { OperationalAccountsServiceContext } from "../internal/context";
import {
  CreateProviderInputSchema,
  type CreateProviderInput,
} from "../validation";

export function createCreateProviderHandler(context: OperationalAccountsServiceContext) {
  const { db, log } = context;

  return async function createProvider(input: CreateProviderInput) {
    const validated = CreateProviderInputSchema.parse(input);

    const [created] = await db
      .insert(schema.operationalAccountProviders)
      .values({
        type: validated.type,
        name: validated.name,
        description: validated.description ?? null,
        country: validated.country,
        address: validated.address ?? null,
        contact: validated.contact ?? null,
        bic: validated.bic ?? null,
        swift: validated.swift ?? null,
      })
      .returning();

    log.info("Account provider created", {
      id: created!.id,
      name: created!.name,
    });

    return created!;
  };
}
