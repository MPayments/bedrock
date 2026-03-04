import { and, eq } from "drizzle-orm";

import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@bedrock/kernel";
import { ACCOUNT_NO } from "@bedrock/core/accounting";

import type { Database, Transaction } from "../client";
import { schema } from "../schema";
import { seedCurrencies } from "./currencies";
import {
  ensureSeedCounterpartyMembership,
  ensureSeedCustomerGroups,
  ensureSeedSystemGroups,
} from "./internal/counterparty-groups";

// ── Stable IDs ──────────────────────────────────────────────────────────────

export const CUSTOMER_IDS = {
  ACME: "00000000-0000-4000-8000-000000000201",
  GLOBEX: "00000000-0000-4000-8000-000000000202",
  INITECH: "00000000-0000-4000-8000-000000000203",
  UMBRELLA: "00000000-0000-4000-8000-000000000204",
} as const;

export const COUNTERPARTY_IDS = {
  ACME_LLC: "00000000-0000-4000-8000-000000000301",
  GLOBEX_CORP: "00000000-0000-4000-8000-000000000302",
  INITECH_LTD: "00000000-0000-4000-8000-000000000303",
  UMBRELLA_GROUP: "00000000-0000-4000-8000-000000000304",
  OWN_ENTITY: "00000000-0000-4000-8000-000000000310",
} as const;

const INTERNAL_LEDGER_COUNTERPARTY_IDS = [COUNTERPARTY_IDS.OWN_ENTITY] as const;

export const PROVIDER_IDS = {
  MAIN_BANK: "00000000-0000-4000-8000-000000000401",
  CRYPTO_EXCHANGE: "00000000-0000-4000-8000-000000000402",
  ALT_BANK: "00000000-0000-4000-8000-000000000403",
  PAYMENT_GATEWAY: "00000000-0000-4000-8000-000000000404",
} as const;

export const COUNTERPARTY_ACCOUNT_IDS = {
  OWN_USD: "00000000-0000-4000-8000-000000000501",
  OWN_EUR: "00000000-0000-4000-8000-000000000502",
  ACME_USD: "00000000-0000-4000-8000-000000000511",
  ACME_EUR: "00000000-0000-4000-8000-000000000512",
  GLOBEX_USD: "00000000-0000-4000-8000-000000000521",
  EXCHANGE_USDT: "00000000-0000-4000-8000-000000000531",
  OWN_CNY: "00000000-0000-4000-8000-000000000541",
  OWN_JPY: "00000000-0000-4000-8000-000000000542",
  INITECH_GBP: "00000000-0000-4000-8000-000000000551",
  UMBRELLA_AED: "00000000-0000-4000-8000-000000000552",
  UMBRELLA_USDT: "00000000-0000-4000-8000-000000000553",
} as const;

// ── Seed data ───────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { id: CUSTOMER_IDS.ACME, displayName: "Acme Inc.", externalRef: "acme-001" },
  {
    id: CUSTOMER_IDS.GLOBEX,
    displayName: "Globex Corporation",
    externalRef: "globex-001",
  },
  {
    id: CUSTOMER_IDS.INITECH,
    displayName: "Initech",
    externalRef: "initech-001",
  },
  {
    id: CUSTOMER_IDS.UMBRELLA,
    displayName: "Umbrella Group",
    externalRef: "umbrella-001",
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
  {
    id: COUNTERPARTY_IDS.INITECH_LTD,
    customerId: CUSTOMER_IDS.INITECH,
    shortName: "Initech Ltd",
    fullName: "Initech Limited",
    kind: "legal_entity" as const,
    country: "GB" as const,
  },
  {
    id: COUNTERPARTY_IDS.UMBRELLA_GROUP,
    customerId: CUSTOMER_IDS.UMBRELLA,
    shortName: "Umbrella Group",
    fullName: "Umbrella Holdings Group",
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
  {
    id: PROVIDER_IDS.ALT_BANK,
    type: "bank" as const,
    name: "Alternative Settlement Bank",
    country: "GB" as const,
    swift: "ALTBGB2LXXX",
  },
  {
    id: PROVIDER_IDS.PAYMENT_GATEWAY,
    type: "exchange" as const,
    name: "Global Payment Gateway",
    country: "AE" as const,
  },
];

const COUNTERPARTY_ACCOUNTS = [
  {
    id: COUNTERPARTY_ACCOUNT_IDS.OWN_USD,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USD",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Own USD (Main Bank)",
    stableKey: "own-usd-main",
    accountNo: "AE000001",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.OWN_EUR,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "EUR",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Own EUR (Main Bank)",
    stableKey: "own-eur-main",
    accountNo: "AE000002",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.ACME_USD,
    counterpartyId: COUNTERPARTY_IDS.ACME_LLC,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USD",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Acme USD",
    stableKey: "acme-usd-main",
    accountNo: "US000001",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.ACME_EUR,
    counterpartyId: COUNTERPARTY_IDS.ACME_LLC,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "EUR",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Acme EUR",
    stableKey: "acme-eur-main",
    accountNo: "EU000001",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.GLOBEX_USD,
    counterpartyId: COUNTERPARTY_IDS.GLOBEX_CORP,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USD",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Globex USD",
    stableKey: "globex-usd-main",
    accountNo: "GB000001",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.EXCHANGE_USDT,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USDT",
    accountProviderId: PROVIDER_IDS.CRYPTO_EXCHANGE,
    label: "Own USDT (Exchange)",
    stableKey: "own-usdt-exchange",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.OWN_CNY,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "CNY",
    accountProviderId: PROVIDER_IDS.ALT_BANK,
    label: "Own CNY (Alt Bank)",
    stableKey: "own-cny-alt",
    accountNo: "CN000001",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.OWN_JPY,
    counterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "JPY",
    accountProviderId: PROVIDER_IDS.ALT_BANK,
    label: "Own JPY (Alt Bank)",
    stableKey: "own-jpy-alt",
    accountNo: "JP000001",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.INITECH_GBP,
    counterpartyId: COUNTERPARTY_IDS.INITECH_LTD,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "GBP",
    accountProviderId: PROVIDER_IDS.ALT_BANK,
    label: "Initech GBP",
    stableKey: "initech-gbp-alt",
    accountNo: "GB000101",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.UMBRELLA_AED,
    counterpartyId: COUNTERPARTY_IDS.UMBRELLA_GROUP,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "AED",
    accountProviderId: PROVIDER_IDS.MAIN_BANK,
    label: "Umbrella AED",
    stableKey: "umbrella-aed-main",
    accountNo: "AE000101",
  },
  {
    id: COUNTERPARTY_ACCOUNT_IDS.UMBRELLA_USDT,
    counterpartyId: COUNTERPARTY_IDS.UMBRELLA_GROUP,
    ledgerEntityCounterpartyId: COUNTERPARTY_IDS.OWN_ENTITY,
    currencyCode: "USDT",
    accountProviderId: PROVIDER_IDS.PAYMENT_GATEWAY,
    label: "Umbrella USDT",
    stableKey: "umbrella-usdt-gateway",
  },
];

// ── Seed function ───────────────────────────────────────────────────────────

async function currencyIdByCodeMap(db: Database | Transaction) {
  const out = new Map<string, string>();
  const rows = await db
    .select({ id: schema.currencies.id, code: schema.currencies.code })
    .from(schema.currencies);
  for (const row of rows) out.set(row.code, row.id);
  return out;
}

async function upsertCustomers(db: Database | Transaction) {
  for (const customer of CUSTOMERS) {
    const [existing] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.id, customer.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.customers).values({
        id: customer.id,
        displayName: customer.displayName,
        externalRef: customer.externalRef,
      });
      continue;
    }

    await db
      .update(schema.customers)
      .set({
        displayName: customer.displayName,
        externalRef: customer.externalRef,
      })
      .where(eq(schema.customers.id, customer.id));
  }
}

async function upsertCounterparties(
  db: Database | Transaction,
  customerGroupIdByCustomerId: ReadonlyMap<string, string>,
) {
  for (const counterparty of COUNTERPARTIES) {
    const [existing] = await db
      .select({ id: schema.counterparties.id })
      .from(schema.counterparties)
      .where(eq(schema.counterparties.id, counterparty.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.counterparties).values({
        id: counterparty.id,
        customerId: counterparty.customerId,
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        kind: counterparty.kind,
        country: counterparty.country,
      });
    } else {
      await db
        .update(schema.counterparties)
        .set({
          customerId: counterparty.customerId,
          shortName: counterparty.shortName,
          fullName: counterparty.fullName,
          kind: counterparty.kind,
          country: counterparty.country,
        })
        .where(eq(schema.counterparties.id, counterparty.id));
    }

    if (!counterparty.customerId) {
      continue;
    }

    const customerGroupId = customerGroupIdByCustomerId.get(counterparty.customerId);
    if (!customerGroupId) {
      throw new Error(
        `Customer group missing for seeded customer ${counterparty.customerId}`,
      );
    }

    await ensureSeedCounterpartyMembership(db, counterparty.id, customerGroupId);
  }
}

async function ensureSeedCustomerGroupMap(
  db: Database | Transaction,
): Promise<Map<string, string>> {
  return ensureSeedCustomerGroups(
    db,
    CUSTOMERS.map((customer) => ({
      id: customer.id,
      displayName: customer.displayName,
    })),
  );
}

async function upsertCounterpartiesWithCustomerGroups(db: Database | Transaction) {
  const customerGroupIdByCustomerId = await ensureSeedCustomerGroupMap(db);
  await upsertCounterparties(db, customerGroupIdByCustomerId);
}

async function ensureInternalLedgerCounterpartyMemberships(
  db: Database | Transaction,
) {
  const { treasuryInternalLedgerGroupId } = await ensureSeedSystemGroups(db);

  for (const counterpartyId of INTERNAL_LEDGER_COUNTERPARTY_IDS) {
    await ensureSeedCounterpartyMembership(
      db,
      counterpartyId,
      treasuryInternalLedgerGroupId,
    );
  }
}

async function ensureSeedCustomersAndCounterparties(db: Database | Transaction) {
  await upsertCustomers(db);
  await upsertCounterpartiesWithCustomerGroups(db);
  await ensureInternalLedgerCounterpartyMemberships(db);
}

async function upsertAccountProviders(db: Database | Transaction) {
  for (const provider of PROVIDERS) {
    const [existing] = await db
      .select({ id: schema.counterpartyAccountProviders.id })
      .from(schema.counterpartyAccountProviders)
      .where(eq(schema.counterpartyAccountProviders.id, provider.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.counterpartyAccountProviders).values({
        id: provider.id,
        type: provider.type,
        name: provider.name,
        country: provider.country,
        swift: "swift" in provider ? provider.swift : undefined,
      });
      continue;
    }

    await db
      .update(schema.counterpartyAccountProviders)
      .set({
        type: provider.type,
        name: provider.name,
        country: provider.country,
        swift: "swift" in provider ? provider.swift : undefined,
      })
      .where(eq(schema.counterpartyAccountProviders.id, provider.id));
  }
}

async function upsertCounterpartyAccounts(
  db: Database | Transaction,
  currencyIdByCode: Map<string, string>,
) {
  for (const counterpartyAccount of COUNTERPARTY_ACCOUNTS) {
    const currencyId = currencyIdByCode.get(counterpartyAccount.currencyCode);
    if (!currencyId) {
      throw new Error(
        `Currency not found for code ${counterpartyAccount.currencyCode} — run counterparties/counterparty-account-providers seed first`,
      );
    }

    const [existing] = await db
      .select({ id: schema.counterpartyAccounts.id })
      .from(schema.counterpartyAccounts)
      .where(eq(schema.counterpartyAccounts.id, counterpartyAccount.id))
      .limit(1);

    if (!existing) {
      await db.insert(schema.counterpartyAccounts).values({
        id: counterpartyAccount.id,
        counterpartyId: counterpartyAccount.counterpartyId,
        ledgerEntityCounterpartyId: counterpartyAccount.ledgerEntityCounterpartyId,
        currencyId,
        accountProviderId: counterpartyAccount.accountProviderId,
        label: counterpartyAccount.label,
        stableKey: counterpartyAccount.stableKey,
        accountNo: counterpartyAccount.accountNo ?? null,
      });
      continue;
    }

    await db
      .update(schema.counterpartyAccounts)
      .set({
        counterpartyId: counterpartyAccount.counterpartyId,
        ledgerEntityCounterpartyId: counterpartyAccount.ledgerEntityCounterpartyId,
        currencyId,
        accountProviderId: counterpartyAccount.accountProviderId,
        label: counterpartyAccount.label,
        stableKey: counterpartyAccount.stableKey,
        accountNo: counterpartyAccount.accountNo ?? null,
      })
      .where(eq(schema.counterpartyAccounts.id, counterpartyAccount.id));
  }
}

function counterpartyDefaultBookCode(counterpartyId: string) {
  return `counterparty-default:${counterpartyId}`;
}

function counterpartyDefaultBookName(counterpartyId: string) {
  return `Counterparty ${counterpartyId} default book`;
}

async function ensureDefaultBooks(
  db: Database | Transaction,
): Promise<Map<string, string>> {
  const counterpartyIds = Array.from(INTERNAL_LEDGER_COUNTERPARTY_IDS);
  const out = new Map<string, string>();

  for (const counterpartyId of counterpartyIds) {
    const [defaultBook] = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(
        and(
          eq(schema.books.counterpartyId, counterpartyId),
          eq(schema.books.isDefault, true),
        ),
      )
      .limit(1);

    if (defaultBook) {
      out.set(counterpartyId, defaultBook.id);
      continue;
    }

    const code = counterpartyDefaultBookCode(counterpartyId);
    const [createdBook] = await db
      .insert(schema.books)
      .values({
        counterpartyId,
        code,
        name: counterpartyDefaultBookName(counterpartyId),
        isDefault: true,
      })
      .onConflictDoNothing({
        target: schema.books.code,
      })
      .returning({ id: schema.books.id });

    if (createdBook) {
      out.set(counterpartyId, createdBook.id);
      continue;
    }

    const [byCode] = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.code, code))
      .limit(1);

    if (!byCode) {
      throw new Error(
        `Failed to create or fetch default book for counterparty ${counterpartyId}`,
      );
    }

    out.set(counterpartyId, byCode.id);
  }

  return out;
}

async function upsertCounterpartyAccountBindings(
  db: Database | Transaction,
  defaultBookIdByInternalCounterpartyId: ReadonlyMap<string, string>,
) {
  for (const counterpartyAccount of COUNTERPARTY_ACCOUNTS) {
    const bookId = defaultBookIdByInternalCounterpartyId.get(
      counterpartyAccount.ledgerEntityCounterpartyId,
    );
    if (!bookId) {
      throw new Error(
        `Book not found for internal ledger counterparty ${counterpartyAccount.ledgerEntityCounterpartyId}`,
      );
    }

    const dimensions = { counterpartyAccountId: counterpartyAccount.id };
    const dimensionsHash = computeDimensionsHash(dimensions);
    const tbLedger = tbLedgerForCurrency(counterpartyAccount.currencyCode);
    const tbAccountId = tbBookAccountInstanceIdFor(
      bookId,
      ACCOUNT_NO.BANK,
      counterpartyAccount.currencyCode,
      dimensionsHash,
      tbLedger,
    );

    const [instance] = await db
      .insert(schema.bookAccountInstances)
      .values({
        bookId,
        accountNo: ACCOUNT_NO.BANK,
        currency: counterpartyAccount.currencyCode,
        dimensions,
        dimensionsHash,
        tbLedger,
        tbAccountId,
      })
      .onConflictDoUpdate({
        target: [
          schema.bookAccountInstances.bookId,
          schema.bookAccountInstances.accountNo,
          schema.bookAccountInstances.currency,
          schema.bookAccountInstances.dimensionsHash,
        ],
        set: {
          tbLedger,
          tbAccountId,
          dimensions,
        },
      })
      .returning({ id: schema.bookAccountInstances.id });

    if (!instance) {
      throw new Error(
        `Failed to upsert book account instance for counterparty account ${counterpartyAccount.id}`,
      );
    }

    await db
      .insert(schema.counterpartyAccountBindings)
      .values({
        counterpartyAccountId: counterpartyAccount.id,
        bookId,
        bookAccountInstanceId: instance.id,
      })
      .onConflictDoUpdate({
        target: schema.counterpartyAccountBindings.counterpartyAccountId,
        set: {
          bookId,
          bookAccountInstanceId: instance.id,
        },
      });
  }
}

export async function seedCounterparties(db: Database | Transaction) {
  await ensureSeedCustomersAndCounterparties(db);

  console.log(
    `[seed:counterparties] Seeded ${COUNTERPARTIES.length} counterparties (${CUSTOMERS.length} customers ensured)`,
  );
}

export async function seedCounterpartyAccountProviders(
  db: Database | Transaction,
) {
  await upsertAccountProviders(db);

  console.log(
    `[seed:counterparty-account-providers] Seeded ${PROVIDERS.length} counterparty account providers`,
  );
}

export async function seedCounterpartyAccounts(db: Database | Transaction) {
  await seedCurrencies(db as Database);
  await ensureSeedCustomersAndCounterparties(db);
  await upsertAccountProviders(db);

  const currencyIdByCode = await currencyIdByCodeMap(db);
  await upsertCounterpartyAccounts(db, currencyIdByCode);
  const counterpartyBookIdByCounterpartyId = await ensureDefaultBooks(db);
  await upsertCounterpartyAccountBindings(db, counterpartyBookIdByCounterpartyId);

  console.log(
    `[seed:counterparty-accounts] Seeded ${COUNTERPARTY_ACCOUNTS.length} counterparty accounts`,
  );
}

export async function seedCounterpartyDomain(db: Database | Transaction) {
  await seedCurrencies(db as Database);
  await ensureSeedCustomersAndCounterparties(db);
  await upsertAccountProviders(db);
  const currencyIdByCode = await currencyIdByCodeMap(db);
  await upsertCounterpartyAccounts(db, currencyIdByCode);
  const counterpartyBookIdByCounterpartyId = await ensureDefaultBooks(db);
  await upsertCounterpartyAccountBindings(db, counterpartyBookIdByCounterpartyId);

  console.log(
    `[seed:counterparty-domain] Completed (${COUNTERPARTIES.length} counterparties, ${PROVIDERS.length} counterparty account providers, ${COUNTERPARTY_ACCOUNTS.length} counterparty accounts)`,
  );
}
