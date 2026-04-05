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
} as const;

export const ORGANIZATION_IDS = {
  MULTIHANSA_PRIMARY: "00000000-0000-4000-8000-000000000310",
  MULTIHANSA_RUSSIA: "00000000-0000-4000-8000-000000000320",
} as const;

export const REQUISITE_PROVIDER_IDS = {
  MAIN_BANK: "00000000-0000-4000-8000-000000000401",
  CRYPTO_EXCHANGE: "00000000-0000-4000-8000-000000000402",
  ALT_BANK: "00000000-0000-4000-8000-000000000403",
  PAYMENT_GATEWAY: "00000000-0000-4000-8000-000000000404",
  RUSSIAN_BANK: "00000000-0000-4000-8000-000000000405",
} as const;

export const REQUISITE_IDS = {
  MULTIHANSA_USD: "00000000-0000-4000-8000-000000000501",
  MULTIHANSA_EUR: "00000000-0000-4000-8000-000000000502",
  MULTIHANSA_RUB: "00000000-0000-4000-8000-000000000503",
  MULTIHANSA_RUSSIA_RUB: "00000000-0000-4000-8000-000000000504",
  ACME_USD: "00000000-0000-4000-8000-000000000511",
  ACME_EUR: "00000000-0000-4000-8000-000000000512",
  GLOBEX_USD: "00000000-0000-4000-8000-000000000521",
  MULTIHANSA_USDT: "00000000-0000-4000-8000-000000000531",
  MULTIHANSA_CNY: "00000000-0000-4000-8000-000000000541",
  MULTIHANSA_JPY: "00000000-0000-4000-8000-000000000542",
  INITECH_GBP: "00000000-0000-4000-8000-000000000551",
  UMBRELLA_AED: "00000000-0000-4000-8000-000000000552",
  UMBRELLA_USDT: "00000000-0000-4000-8000-000000000553",
} as const;

export const CUSTOMERS = [
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

export const COUNTERPARTIES = [
  {
    id: COUNTERPARTY_IDS.ACME_LLC,
    customerId: CUSTOMER_IDS.ACME,
    externalId: "acme-llc",
    shortName: "Acme LLC",
    fullName: "Acme Limited Liability Company",
    kind: "legal_entity" as const,
    country: "US" as const,
  },
  {
    id: COUNTERPARTY_IDS.GLOBEX_CORP,
    customerId: CUSTOMER_IDS.GLOBEX,
    externalId: "globex-corp",
    shortName: "Globex Corp",
    fullName: "Globex Corporation",
    kind: "legal_entity" as const,
    country: "GB" as const,
  },
  {
    id: COUNTERPARTY_IDS.INITECH_LTD,
    customerId: CUSTOMER_IDS.INITECH,
    externalId: "initech-ltd",
    shortName: "Initech Ltd",
    fullName: "Initech Limited",
    kind: "legal_entity" as const,
    country: "GB" as const,
  },
  {
    id: COUNTERPARTY_IDS.UMBRELLA_GROUP,
    customerId: CUSTOMER_IDS.UMBRELLA,
    externalId: "umbrella-group",
    shortName: "Umbrella Group",
    fullName: "Umbrella Holdings Group",
    kind: "legal_entity" as const,
    country: "AE" as const,
  },
] as const;

export const ORGANIZATIONS = [
  {
    id: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    externalId: "multihansa-primary",
    shortName: "Multihansa",
    fullName: "Multihansa Financial Services Ltd",
    description: "Primary treasury and accounting organization",
    kind: "legal_entity" as const,
    country: "AE" as const,
  },
  {
    id: ORGANIZATION_IDS.MULTIHANSA_RUSSIA,
    externalId: "multihansa-russia",
    shortName: "Multihansa Russia",
    fullName: "Multihansa Russia LLC",
    description: "Russia operating organization for local treasury and accounting",
    kind: "legal_entity" as const,
    country: "RU" as const,
  },
] as const;

export const REQUISITE_PROVIDERS = [
  {
    id: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    kind: "bank" as const,
    name: "Main Settlement Bank",
    description: "Primary settlement bank",
    country: "AE" as const,
    address: "Dubai International Financial Centre",
    contact: "ops@main-bank.example",
    bic: null,
    swift: "BEDRAEADXXX",
  },
  {
    id: REQUISITE_PROVIDER_IDS.CRYPTO_EXCHANGE,
    kind: "exchange" as const,
    name: "Crypto Exchange",
    description: "Primary exchange venue",
    country: "US" as const,
    address: null,
    contact: "support@crypto-exchange.example",
    bic: null,
    swift: null,
  },
  {
    id: REQUISITE_PROVIDER_IDS.ALT_BANK,
    kind: "bank" as const,
    name: "Alternative Settlement Bank",
    description: "Secondary settlement bank",
    country: "GB" as const,
    address: "1 Bishopsgate, London",
    contact: "ops@alt-bank.example",
    bic: null,
    swift: "ALTBGB2LXXX",
  },
  {
    id: REQUISITE_PROVIDER_IDS.PAYMENT_GATEWAY,
    kind: "exchange" as const,
    name: "Global Payment Gateway",
    description: "Digital asset settlement gateway",
    country: "AE" as const,
    address: null,
    contact: "support@gateway.example",
    bic: null,
    swift: null,
  },
  {
    id: REQUISITE_PROVIDER_IDS.RUSSIAN_BANK,
    kind: "bank" as const,
    name: "Russian Settlement Bank",
    description: "RUB settlement bank for local treasury operations",
    country: "RU" as const,
    address: "Moscow, Russia",
    contact: "ops@ru-settlement-bank.example",
    bic: "044525225",
    swift: null,
  },
] as const;

export interface SeedRequisiteFixture {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  providerId: string;
  currencyCode: string;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  label: string;
  description?: string | null;
  beneficiaryName?: string | null;
  institutionName?: string | null;
  accountNo?: string | null;
  corrAccount?: string | null;
  iban?: string | null;
  bic?: string | null;
  swift?: string | null;
  bankAddress?: string | null;
  network?: string | null;
  assetCode?: string | null;
  address?: string | null;
  memoTag?: string | null;
  accountRef?: string | null;
  subaccountRef?: string | null;
  contact?: string | null;
  notes?: string | null;
  isDefault?: boolean;
  postingAccountNo?: string;
}

export const REQUISITES: readonly SeedRequisiteFixture[] = [
  {
    id: REQUISITE_IDS.MULTIHANSA_USD,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    providerId: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Multihansa USD",
    beneficiaryName: "Multihansa Financial Services Ltd",
    institutionName: "Main Settlement Bank",
    accountNo: "AE000001",
    swift: "BEDRAEADXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_EUR,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    providerId: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    currencyCode: "EUR",
    kind: "bank",
    label: "Multihansa EUR",
    beneficiaryName: "Multihansa Financial Services Ltd",
    institutionName: "Main Settlement Bank",
    accountNo: "AE000002",
    swift: "BEDRAEADXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    providerId: REQUISITE_PROVIDER_IDS.RUSSIAN_BANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB",
    beneficiaryName: "Multihansa Financial Services Ltd",
    institutionName: "Russian Settlement Bank",
    accountNo: "40702810900000000001",
    corrAccount: "30101810400000000225",
    bic: "044525225",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_USDT,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    providerId: REQUISITE_PROVIDER_IDS.CRYPTO_EXCHANGE,
    currencyCode: "USDT",
    kind: "exchange",
    label: "Multihansa USDT",
    institutionName: "Crypto Exchange",
    accountRef: "multihansa-usdt-main",
    notes: "Primary digital asset omnibus account",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_CNY,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    providerId: REQUISITE_PROVIDER_IDS.ALT_BANK,
    currencyCode: "CNY",
    kind: "bank",
    label: "Multihansa CNY",
    beneficiaryName: "Multihansa Financial Services Ltd",
    institutionName: "Alternative Settlement Bank",
    accountNo: "CN000001",
    swift: "ALTBGB2LXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_JPY,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_PRIMARY,
    providerId: REQUISITE_PROVIDER_IDS.ALT_BANK,
    currencyCode: "JPY",
    kind: "bank",
    label: "Multihansa JPY",
    beneficiaryName: "Multihansa Financial Services Ltd",
    institutionName: "Alternative Settlement Bank",
    accountNo: "JP000001",
    swift: "ALTBGB2LXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_RUSSIA_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_RUSSIA,
    providerId: REQUISITE_PROVIDER_IDS.RUSSIAN_BANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa Russia RUB",
    beneficiaryName: "Multihansa Russia LLC",
    institutionName: "Russian Settlement Bank",
    accountNo: "40702810900000000002",
    corrAccount: "30101810400000000225",
    bic: "044525225",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ACME_USD,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.ACME_LLC,
    providerId: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Acme USD",
    beneficiaryName: "Acme Limited Liability Company",
    institutionName: "Main Settlement Bank",
    accountNo: "US000001",
    swift: "BEDRAEADXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ACME_EUR,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.ACME_LLC,
    providerId: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    currencyCode: "EUR",
    kind: "bank",
    label: "Acme EUR",
    beneficiaryName: "Acme Limited Liability Company",
    institutionName: "Main Settlement Bank",
    accountNo: "EU000001",
    swift: "BEDRAEADXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.GLOBEX_USD,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.GLOBEX_CORP,
    providerId: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Globex USD",
    beneficiaryName: "Globex Corporation",
    institutionName: "Main Settlement Bank",
    accountNo: "GB000001",
    swift: "BEDRAEADXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.INITECH_GBP,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.INITECH_LTD,
    providerId: REQUISITE_PROVIDER_IDS.ALT_BANK,
    currencyCode: "GBP",
    kind: "bank",
    label: "Initech GBP",
    beneficiaryName: "Initech Limited",
    institutionName: "Alternative Settlement Bank",
    accountNo: "GB000101",
    swift: "ALTBGB2LXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.UMBRELLA_AED,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.UMBRELLA_GROUP,
    providerId: REQUISITE_PROVIDER_IDS.MAIN_BANK,
    currencyCode: "AED",
    kind: "bank",
    label: "Umbrella AED",
    beneficiaryName: "Umbrella Holdings Group",
    institutionName: "Main Settlement Bank",
    accountNo: "AE000101",
    swift: "BEDRAEADXXX",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.UMBRELLA_USDT,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.UMBRELLA_GROUP,
    providerId: REQUISITE_PROVIDER_IDS.PAYMENT_GATEWAY,
    currencyCode: "USDT",
    kind: "exchange",
    label: "Umbrella USDT",
    institutionName: "Global Payment Gateway",
    accountRef: "umbrella-usdt-gateway",
    notes: "Gateway settlement balance",
    isDefault: true,
  },
] as const;
