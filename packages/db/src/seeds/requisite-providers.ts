import type { Database, Transaction } from "../client";
import { schema } from "../schema";
import { REQUISITE_PROVIDERS } from "./fixtures";

export { REQUISITE_PROVIDER_IDS } from "./fixtures";

export async function seedRequisiteProviders(db: Database | Transaction) {
  for (const provider of REQUISITE_PROVIDERS) {
    await db
      .insert(schema.requisiteProviders)
      .values({
        id: provider.id,
        kind: provider.kind,
        name: provider.name,
        description: provider.description,
        country: provider.country,
        address: provider.address,
        contact: provider.contact,
        bic: provider.bic,
        swift: provider.swift,
      })
      .onConflictDoUpdate({
        target: schema.requisiteProviders.id,
        set: {
          kind: provider.kind,
          name: provider.name,
          description: provider.description,
          country: provider.country,
          address: provider.address,
          contact: provider.contact,
          bic: provider.bic,
          swift: provider.swift,
        },
      });
  }

  console.log(
    `[seed:requisite-providers] Seeded ${REQUISITE_PROVIDERS.length} requisite providers`,
  );
}
