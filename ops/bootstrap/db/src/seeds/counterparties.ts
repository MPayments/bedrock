import type { Database, Transaction } from "@bedrock/adapter-db-drizzle/client";
import { schema } from "@bedrock/adapter-db-drizzle";
import { COUNTERPARTIES, CUSTOMERS } from "./fixtures";

async function upsertCustomers(db: Database | Transaction) {
  for (const customer of CUSTOMERS) {
    await db
      .insert(schema.customers)
      .values({
        id: customer.id,
        displayName: customer.displayName,
        externalRef: customer.externalRef,
      })
      .onConflictDoUpdate({
        target: schema.customers.id,
        set: {
          displayName: customer.displayName,
          externalRef: customer.externalRef,
        },
      });
  }
}

async function upsertCounterparties(db: Database | Transaction) {
  for (const counterparty of COUNTERPARTIES) {
    await db
      .insert(schema.counterparties)
      .values({
        id: counterparty.id,
        externalId: counterparty.externalId,
        customerId: counterparty.customerId,
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        kind: counterparty.kind,
        country: counterparty.country,
      })
      .onConflictDoUpdate({
        target: schema.counterparties.id,
        set: {
          externalId: counterparty.externalId,
          customerId: counterparty.customerId,
          shortName: counterparty.shortName,
          fullName: counterparty.fullName,
          kind: counterparty.kind,
          country: counterparty.country,
        },
      });
  }
}

export async function seedCounterparties(db: Database | Transaction) {
  await upsertCustomers(db);
  await upsertCounterparties(db);

  console.log(
    `[seed:counterparties] Seeded ${COUNTERPARTIES.length} counterparties (${CUSTOMERS.length} customers ensured)`,
  );
}
