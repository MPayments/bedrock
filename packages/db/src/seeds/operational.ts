import { eq } from "drizzle-orm";

import type { Database, Transaction } from "../client";
import { schema } from "../schema";
import { seedCurrencies } from "./currencies";

// ── Stable IDs ──────────────────────────────────────────────────────────────

export const CUSTOMER_IDS = {
  ACME: "00000000-0000-4000-8000-000000000201",
  GLOBEX: "00000000-0000-4000-8000-000000000202",
} as const;

export const COUNTERPARTY_IDS = {
  ACME_LLC: "00000000-0000-4000-8000-000000000301",
  GLOBEX_CORP: "00000000-0000-4000-8000-000000000302",
  OWN_ENTITY: "00000000-0000-4000-8000-000000000310",
} as const;

export const PROVIDER_IDS = {
  MAIN_BANK: "00000000-0000-4000-8000-000000000401",
  CRYPTO_EXCHANGE: "00000000-0000-4000-8000-000000000402",
} as const;

export const OA_IDS = {
  OWN_USD: "00000000-0000-4000-8000-000000000501",
  OWN_EUR: "00000000-0000-4000-8000-000000000502",
  ACME_USD: "00000000-0000-4000-8000-000000000511",
  ACME_EUR: "00000000-0000-4000-8000-000000000512",
  GLOBEX_USD: "00000000-0000-4000-8000-000000000521",
  EXCHANGE_USDT: "00000000-0000-4000-8000-000000000531",
} as const;

// ── Seed data ───────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { id: CUSTOMER_IDS.ACME, displayName: "Acme Inc.", externalRef: "acme-001" },
  {
    id: CUSTOMER_IDS.GLOBEX,
    displayName: "Globex Corporation",
    externalRef: "globex-001",
  },
] as const;

const COUNTERPARTIES = [
  {
    id: COUNTERPARTY_IDS.ACME_LLC,
    customerId: CUSTOMER_IDS.ACME,
    shortName: "Acme LLC",
    fullName: "Acme Limited Liability Company",
    kind: "legal_entity" as const,
    country: "US" as const,
  },
  {
    id: COUNTERPARTY_IDS.GLOBEX_CORP,
    customerId: CUSTOMER_IDS.GLOBEX,
    shortName: "Globex Corp",
    fullName: "Globex Corporation",
    kind: "legal_entity" as const,
    country: "GB" as const,
  },
  {
    id: COUNTERPARTY_IDS.OWN_ENTITY,
    customerId: null,
    shortName: "Own Entity",
    fullName: "Bedrock Financial Services Ltd",
    kind: "legal_entity" as const,
    country: "AE" as const,
  },
];

const PROVIDERS = [
  {
    id: PROVIDER_IDS.MAIN_BANK,
    type: "bank" as const,
    name: "Main Settlement Bank",
    country: "AE" as const,
    swift: "BEDRAEADXXX",
  },
  {
    id: PROVIDER_IDS.CRYPTO_EXCHANGE,
    type: "exchange" as const,
    name: "Crypto Exchange",
    country: "US" as const,
  },
];

const OPERATIONAL_ACCOUNTS = [
  {
    id: OA_IDS.OWN_USD,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USD",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Own USD (Main Bank)",
    stableKey: "own-usd-main",
    accountNo: "AE000001",
  },
  {
    id: OA_IDS.OWN_EUR,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "EUR",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Own EUR (Main Bank)",
    stableKey: "own-eur-main",
    accountNo: "AE000002",
  },
  {
    id: OA_IDS.ACME_USD,
    counterpartyId: COUNTERPARTY_IDS.ACME_LLC,
    currencyCode: "USD",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Acme USD",
    stableKey: "acme-usd-main",
    accountNo: "US000001",
  },
  {
    id: OA_IDS.ACME_EUR,
    counterpartyId: COUNTERPARTY_IDS.ACME_LLC,
    currencyCode: "EUR",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Acme EUR",
    stableKey: "acme-eur-main",
    accountNo: "EU000001",
  },
  {
    id: OA_IDS.GLOBEX_USD,
    counterpartyId: COUNTERPARTY_IDS.GLOBEX_CORP,
    currencyCode: "USD",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Globex USD",
    stableKey: "globex-usd-main",
    accountNo: "GB000001",
  },
  {
    id: OA_IDS.EXCHANGE_USDT,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USDT",
    accountProviderId: PROVIDER_IDS.CRYPTO_EXCHANGE,
    label: "Own USDT (Exchange)",
    stableKey: "own-usdt-exchange",
  },
];

// ── Seed function ───────────────────────────────────────────────────────────

export async function seedOperational(db: Database | Transaction) {
  await seedCurrencies(db as Database);

  const currencyIdByCode = new Map<string, string>();
  const rows = await db
    .select({ id: schema.currencies.id, code: schema.currencies.code })
    .from(schema.currencies);
  for (const r of rows) currencyIdByCode.set(r.code, r.id);

  // Customers
  for (const c of CUSTOMERS) {
    const [existing] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.id, c.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.customers).values({
        id: c.id,
        displayName: c.displayName,
        externalRef: c.externalRef,
      });
    } else {
      await db
        .update(schema.customers)
        .set({ displayName: c.displayName, externalRef: c.externalRef })
        .where(eq(schema.customers.id, c.id));
    }
  }

  // Counterparties
  for (const cp of COUNTERPARTIES) {
    const [existing] = await db
      .select({ id: schema.counterparties.id })
      .from(schema.counterparties)
      .where(eq(schema.counterparties.id, cp.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.counterparties).values({
        id: cp.id,
        customerId: cp.customerId,
        shortName: cp.shortName,
        fullName: cp.fullName,
        kind: cp.kind,
        country: cp.country,
      });
    } else {
      await db
        .update(schema.counterparties)
        .set({
          customerId: cp.customerId,
          shortName: cp.shortName,
          fullName: cp.fullName,
          kind: cp.kind,
          country: cp.country,
        })
        .where(eq(schema.counterparties.id, cp.id));
    }
  }

  // Providers
  for (const p of PROVIDERS) {
    const [existing] = await db
      .select({ id: schema.operationalAccountProviders.id })
      .from(schema.operationalAccountProviders)
      .where(eq(schema.operationalAccountProviders.id, p.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.operationalAccountProviders).values({
        id: p.id,
        type: p.type,
        name: p.name,
        country: p.country,
        swift: "swift" in p ? p.swift : undefined,
      });
    } else {
      await db
        .update(schema.operationalAccountProviders)
        .set({
          type: p.type,
          name: p.name,
          country: p.country,
          swift: "swift" in p ? p.swift : undefined,
        })
        .where(eq(schema.operationalAccountProviders.id, p.id));
    }
  }

  // Operational accounts
  for (const oa of OPERATIONAL_ACCOUNTS) {
    const currencyId = currencyIdByCode.get(oa.currencyCode);
    if (!currencyId) {
      throw new Error(
        `Currency not found for code ${oa.currencyCode} — run seedCurrencies first`,
      );
    }

    const [existing] = await db
      .select({ id: schema.operationalAccounts.id })
      .from(schema.operationalAccounts)
      .where(eq(schema.operationalAccounts.id, oa.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.operationalAccounts).values({
        id: oa.id,
        counterpartyId: oa.counterpartyId,
        currencyId,
        accountProviderId: oa.accountProviderId,
        label: oa.label,
        stableKey: oa.stableKey,
        accountNo: oa.accountNo ?? null,
      });
    } else {
      await db
        .update(schema.operationalAccounts)
        .set({
          counterpartyId: oa.counterpartyId,
          currencyId,
          accountProviderId: oa.accountProviderId,
          label: oa.label,
          stableKey: oa.stableKey,
          accountNo: oa.accountNo ?? null,
        })
        .where(eq(schema.operationalAccounts.id, oa.id));
    }
  }

  console.log(
    `[seed:operational] Seeded ${CUSTOMERS.length} customers, ${COUNTERPARTIES.length} counterparties, ${PROVIDERS.length} providers, ${OPERATIONAL_ACCOUNTS.length} operational accounts`,
  );
}
