import {
  CUSTOMER_CONTRACT_INVENTORY,
  CUSTOMER_COUNTERPARTY_SOURCES,
  CUSTOMER_REQUISITE_SOURCES,
  type CounterpartyProfileSource,
  type CustomerContractOrganizationKey,
  type CustomerContractOrganizationRequisiteKey,
  type CustomerContractProviderKey,
  type CustomerCounterpartyKey,
} from "./customer-contract-inventory";

type SeedLocaleTextMap = Record<string, string | null> | null;

export const CUSTOMER_IDS = {
  RUHA_TRADE: "00000000-0000-4000-8000-000000000201",
  MULTIMODAL_LOGISTICS_CENTER: "00000000-0000-4000-8000-000000000202",
  SEMEN_SHAKSHIN: "00000000-0000-4000-8000-000000000203",
  HONGKONG_XINTATRADE: "00000000-0000-4000-8000-000000000204",
  MOSKVA_AMROS: "00000000-0000-4000-8000-000000000205",
  VIDI_TECHNOLAB: "00000000-0000-4000-8000-000000000206",
  RSI_CAPITAL: "00000000-0000-4000-8000-000000000207",
  ONEY_FINANSAL: "00000000-0000-4000-8000-000000000208",
  PRIME_TRADE: "00000000-0000-4000-8000-000000000209",
  COINEX: "00000000-0000-4000-8000-000000000210",
} as const;

export const COUNTERPARTY_IDS = {
  RUHA_TRADE: "00000000-0000-4000-8000-000000000301",
  MULTIMODAL_LOGISTICS_CENTER: "00000000-0000-4000-8000-000000000302",
  SEMEN_SHAKSHIN: "00000000-0000-4000-8000-000000000303",
  HONGKONG_XINTATRADE: "00000000-0000-4000-8000-000000000304",
  MOSKVA_AMROS: "00000000-0000-4000-8000-000000000305",
  VIDI_TECHNOLAB: "00000000-0000-4000-8000-000000000306",
  RSI_CAPITAL: "00000000-0000-4000-8000-000000000307",
  ONEY_FINANSAL: "00000000-0000-4000-8000-000000000308",
  PRIME_TRADE: "00000000-0000-4000-8000-000000000309",
  COINEX: "00000000-0000-4000-8000-000000000311",
} as const;

export const ORGANIZATION_IDS = {
  MULTIHANSA_BROKERS: "00000000-0000-4000-8000-000000000310",
  ARABIAN_FUEL_ALLIANCE: "00000000-0000-4000-8000-000000000320",
} as const;

export const REQUISITE_PROVIDER_IDS = {
  GAZPROMBANK: "00000000-0000-4000-8000-000000000401",
  ABU_DHABI_COMMERCIAL_BANK: "00000000-0000-4000-8000-000000000402",
  SBERBANK_NORTHWEST: "00000000-0000-4000-8000-000000000403",
  BANK_TOCHKA: "00000000-0000-4000-8000-000000000404",
  EXPOBANK: "00000000-0000-4000-8000-000000000405",
  EXI_BANK: "00000000-0000-4000-8000-000000000406",
  VTB_BANK: "00000000-0000-4000-8000-000000000407",
  DUBAI_ISLAMIC_BANK: "00000000-0000-4000-8000-000000000408",
  EMIRATES_ISLAMIC_BANK: "00000000-0000-4000-8000-000000000409",
  SBERBANK_MOSCOW: "00000000-0000-4000-8000-000000000410",
  MTS_BANK: "00000000-0000-4000-8000-000000000411",
} as const;

export const REQUISITE_IDS = {
  MULTIHANSA_ADCB_USD: "00000000-0000-4000-8000-000000000501",
  MULTIHANSA_ADCB_AED: "00000000-0000-4000-8000-000000000502",
  MULTIHANSA_EXPOBANK_RUB: "00000000-0000-4000-8000-000000000503",
  ARABIAN_FUEL_ALLIANCE_DIB_AED: "00000000-0000-4000-8000-000000000504",
  ARABIAN_FUEL_ALLIANCE_DIB_USD: "00000000-0000-4000-8000-000000000505",
  ARABIAN_FUEL_ALLIANCE_DIB_EUR: "00000000-0000-4000-8000-000000000506",
  ARABIAN_FUEL_ALLIANCE_EMIRATES_AED:
    "00000000-0000-4000-8000-000000000507",
  ARABIAN_FUEL_ALLIANCE_EMIRATES_USD:
    "00000000-0000-4000-8000-000000000508",
  ARABIAN_FUEL_ALLIANCE_EXI_RUB: "00000000-0000-4000-8000-000000000509",
  ARABIAN_FUEL_ALLIANCE_EXI_AED: "00000000-0000-4000-8000-000000000510",
  RUHA_RUB_GAZPROMBANK: "00000000-0000-4000-8000-000000000511",
  RUHA_TRY_GAZPROMBANK: "00000000-0000-4000-8000-000000000512",
  MULTIMODAL_RUB_VTB: "00000000-0000-4000-8000-000000000521",
  MULTIHANSA_EXI_RUB: "00000000-0000-4000-8000-000000000531",
  MULTIHANSA_EXI_AED: "00000000-0000-4000-8000-000000000541",
  MULTIHANSA_VTB_RUB: "00000000-0000-4000-8000-000000000542",
  MULTIHANSA_MTS_RUB: "00000000-0000-4000-8000-000000000543",
  SHAKSHIN_RUB_SBERBANK: "00000000-0000-4000-8000-000000000551",
  XINTATRADE_RUB_EXPOBANK: "00000000-0000-4000-8000-000000000552",
  ONEY_RUB_SBERBANK: "00000000-0000-4000-8000-000000000553",
  PRIME_TRADE_RUB_VTB: "00000000-0000-4000-8000-000000000554",
  RSI_CAPITAL_RUB_VTB: "00000000-0000-4000-8000-000000000555",
  COINEX_RUB_BANK_TOCHKA: "00000000-0000-4000-8000-000000000556",
} as const;

const CUSTOMER_ID_BY_KEY: Record<CustomerCounterpartyKey, string> = {
  ruha_trade: CUSTOMER_IDS.RUHA_TRADE,
  multimodal_logistics_center: CUSTOMER_IDS.MULTIMODAL_LOGISTICS_CENTER,
  semen_shakshin: CUSTOMER_IDS.SEMEN_SHAKSHIN,
  hongkong_xintatrade: CUSTOMER_IDS.HONGKONG_XINTATRADE,
  moskva_amros: CUSTOMER_IDS.MOSKVA_AMROS,
  vidi_technolab: CUSTOMER_IDS.VIDI_TECHNOLAB,
  rsi_capital: CUSTOMER_IDS.RSI_CAPITAL,
  oney_finansal: CUSTOMER_IDS.ONEY_FINANSAL,
  prime_trade: CUSTOMER_IDS.PRIME_TRADE,
  coinex: CUSTOMER_IDS.COINEX,
};

const COUNTERPARTY_ID_BY_KEY: Record<CustomerCounterpartyKey, string> = {
  ruha_trade: COUNTERPARTY_IDS.RUHA_TRADE,
  multimodal_logistics_center: COUNTERPARTY_IDS.MULTIMODAL_LOGISTICS_CENTER,
  semen_shakshin: COUNTERPARTY_IDS.SEMEN_SHAKSHIN,
  hongkong_xintatrade: COUNTERPARTY_IDS.HONGKONG_XINTATRADE,
  moskva_amros: COUNTERPARTY_IDS.MOSKVA_AMROS,
  vidi_technolab: COUNTERPARTY_IDS.VIDI_TECHNOLAB,
  rsi_capital: COUNTERPARTY_IDS.RSI_CAPITAL,
  oney_finansal: COUNTERPARTY_IDS.ONEY_FINANSAL,
  prime_trade: COUNTERPARTY_IDS.PRIME_TRADE,
  coinex: COUNTERPARTY_IDS.COINEX,
};

const ORGANIZATION_ID_BY_KEY: Record<CustomerContractOrganizationKey, string> = {
  multihansa_brokers: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
  arabian_fuel_alliance: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
};

const PROVIDER_ID_BY_KEY: Record<CustomerContractProviderKey, string> = {
  gazprombank: REQUISITE_PROVIDER_IDS.GAZPROMBANK,
  sberbank_northwest: REQUISITE_PROVIDER_IDS.SBERBANK_NORTHWEST,
  sberbank_moscow: REQUISITE_PROVIDER_IDS.SBERBANK_MOSCOW,
  bank_tochka: REQUISITE_PROVIDER_IDS.BANK_TOCHKA,
  mts_bank: REQUISITE_PROVIDER_IDS.MTS_BANK,
  expobank: REQUISITE_PROVIDER_IDS.EXPOBANK,
  vtb_bank: REQUISITE_PROVIDER_IDS.VTB_BANK,
};

const ORGANIZATION_REQUISITE_ID_BY_KEY: Record<
  CustomerContractOrganizationRequisiteKey,
  string
> = {
  multihansa_exi_rub: REQUISITE_IDS.MULTIHANSA_EXI_RUB,
  multihansa_mts_rub: REQUISITE_IDS.MULTIHANSA_MTS_RUB,
  arabian_exi_rub: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EXI_RUB,
};

const CUSTOMER_REQUISITE_ID_BY_KEY = {
  ruha_rub_gazprombank: REQUISITE_IDS.RUHA_RUB_GAZPROMBANK,
  ruha_try_gazprombank: REQUISITE_IDS.RUHA_TRY_GAZPROMBANK,
  multimodal_rub_vtb: REQUISITE_IDS.MULTIMODAL_RUB_VTB,
  shakshin_rub_sberbank: REQUISITE_IDS.SHAKSHIN_RUB_SBERBANK,
  xintatrade_rub_expobank: REQUISITE_IDS.XINTATRADE_RUB_EXPOBANK,
  oney_rub_sberbank: REQUISITE_IDS.ONEY_RUB_SBERBANK,
  prime_trade_rub_vtb: REQUISITE_IDS.PRIME_TRADE_RUB_VTB,
  rsi_capital_rub_vtb: REQUISITE_IDS.RSI_CAPITAL_RUB_VTB,
  coinex_rub_bank_tochka: REQUISITE_IDS.COINEX_RUB_BANK_TOCHKA,
} as const;

const PROVIDER_NAME_BY_KEY: Record<CustomerContractProviderKey, string> = {
  gazprombank: "Gazprombank",
  sberbank_northwest: "PJSC Sberbank, North-West Bank",
  sberbank_moscow: "PJSC Sberbank, Moscow",
  bank_tochka: 'ООО "Банк Точка"',
  mts_bank: "MTS-BANK PJSC",
  expobank: 'АО "Экспобанк"',
  vtb_bank: 'Филиал "Центральный" Банка ВТБ (ПАО)',
};

export interface SeedPartyIdentifierFixture {
  scheme: string;
  value: string;
}

export interface SeedPartyAddressFixture {
  countryCode: string | null;
  postalCode?: string | null;
  city?: string | null;
  cityI18n?: SeedLocaleTextMap;
  streetAddress?: string | null;
  streetAddressI18n?: SeedLocaleTextMap;
  addressDetails?: string | null;
  addressDetailsI18n?: SeedLocaleTextMap;
  fullAddress?: string | null;
  fullAddressI18n?: SeedLocaleTextMap;
}

export interface SeedPartyContactFixture {
  type: "email" | "phone" | "website" | "fax" | "other";
  value: string;
  isPrimary?: boolean;
}

export interface SeedPartyRepresentativeFixture {
  role: "director" | "signatory" | "contact" | "authorized_person" | "other";
  fullName: string;
  fullNameI18n?: SeedLocaleTextMap;
  title?: string | null;
  titleI18n?: SeedLocaleTextMap;
  basisDocument?: string | null;
  basisDocumentI18n?: SeedLocaleTextMap;
  isPrimary?: boolean;
}

export interface SeedPartyLicenseFixture {
  type:
    | "company_license"
    | "broker_license"
    | "financial_service_license"
    | "trade_license"
    | "customs_license"
    | "other";
  number: string;
  issuer?: string | null;
  issuerI18n?: SeedLocaleTextMap;
  issuedAt?: string | null;
  expiresAt?: string | null;
  activityText?: string | null;
  activityTextI18n?: SeedLocaleTextMap;
  isPrimary?: boolean;
}

export interface SeedPartyProfileFixture {
  fullName: string;
  shortName: string;
  fullNameI18n?: SeedLocaleTextMap;
  shortNameI18n?: SeedLocaleTextMap;
  legalFormCode?: string | null;
  legalFormLabel?: string | null;
  legalFormLabelI18n?: SeedLocaleTextMap;
  countryCode?: string | null;
  businessActivityText?: string | null;
  businessActivityTextI18n?: SeedLocaleTextMap;
  identifiers?: readonly SeedPartyIdentifierFixture[];
  address?: SeedPartyAddressFixture | null;
  contacts?: readonly SeedPartyContactFixture[];
  representatives?: readonly SeedPartyRepresentativeFixture[];
  licenses?: readonly SeedPartyLicenseFixture[];
}

export interface SeedCounterpartyFixture {
  id: string;
  customerId: string;
  externalRef: string;
  shortName: string;
  fullName: string;
  kind: "legal_entity" | "individual";
  country: string | null;
  profile: SeedPartyProfileFixture;
}

export interface SeedOrganizationFixture {
  id: string;
  externalRef: string | null;
  shortName: string;
  fullName: string;
  shortNameI18n?: SeedLocaleTextMap;
  fullNameI18n?: SeedLocaleTextMap;
  description?: string | null;
  kind: "legal_entity";
  country: string | null;
  orgType?: string | null;
  orgTypeI18n?: SeedLocaleTextMap;
  city?: string | null;
  cityI18n?: SeedLocaleTextMap;
  address?: string | null;
  addressI18n?: SeedLocaleTextMap;
  inn?: string | null;
  taxId?: string | null;
  kpp?: string | null;
  directorName?: string | null;
  directorNameI18n?: SeedLocaleTextMap;
  directorTitle?: string | null;
  directorTitleI18n?: SeedLocaleTextMap;
  directorBasis?: string | null;
  directorBasisI18n?: SeedLocaleTextMap;
  signatureAssetFileName?: string | null;
  sealAssetFileName?: string | null;
}

export interface SeedRequisiteProviderFixture {
  id: string;
  kind: "bank" | "exchange" | "custodian";
  name: string;
  description?: string | null;
  country: string | null;
  address?: string | null;
  contact?: string | null;
  bic?: string | null;
  swift?: string | null;
}

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

export interface SeedAgreementFixture {
  key: string;
  customerId: string;
  organizationId: string;
  organizationRequisiteId: string;
  contractNumber: string;
  contractDate: string;
  isActive: boolean;
  contractKind:
    | "agency_agreement"
    | "service_agreement"
    | "sale_purchase_agreement";
  extractionMode: "pdftotext" | "ocr";
  sourcePdfFile: string;
  feeRules: readonly {
    kind: "agent_fee" | "fixed_fee";
    unit: "bps" | "money";
    value: string;
  }[];
  notes?: string | null;
}

function toSeedPartyProfileFixture(
  source: CounterpartyProfileSource,
  counterparty: {
    fullName: string;
    fullNameI18n?: SeedLocaleTextMap;
    shortName: string;
    shortNameI18n?: SeedLocaleTextMap;
    country: string | null;
  },
): SeedPartyProfileFixture {
  return {
    fullName: counterparty.fullName,
    fullNameI18n: counterparty.fullNameI18n ?? null,
    shortName: counterparty.shortName,
    shortNameI18n: counterparty.shortNameI18n ?? null,
    legalFormCode: source.legalFormCode ?? null,
    legalFormLabel: source.legalFormLabel ?? null,
    legalFormLabelI18n: source.legalFormLabelI18n ?? null,
    countryCode: source.address?.countryCode ?? counterparty.country ?? null,
    businessActivityText: source.businessActivityText ?? null,
    businessActivityTextI18n: source.businessActivityTextI18n ?? null,
    identifiers: source.identifiers ?? [],
    address: source.address
      ? {
          countryCode: source.address.countryCode ?? counterparty.country ?? null,
          postalCode: source.address.postalCode ?? null,
          city: source.address.city ?? null,
          cityI18n: source.address.cityI18n ?? null,
          streetAddress: source.address.streetAddress ?? null,
          streetAddressI18n: source.address.streetAddressI18n ?? null,
          addressDetails: source.address.addressDetails ?? null,
          addressDetailsI18n: source.address.addressDetailsI18n ?? null,
          fullAddress: source.address.fullAddress ?? null,
          fullAddressI18n: source.address.fullAddressI18n ?? null,
        }
      : null,
    contacts: source.contacts ?? [],
    representatives: source.representatives ?? [],
    licenses: (source.licenses ?? []).map((license) => ({
      type: license.type,
      number: license.number,
      issuer: license.issuer ?? null,
      issuerI18n: license.issuerI18n ?? null,
      issuedAt: license.issuedAt ?? null,
      expiresAt: license.expiresAt ?? null,
      activityText: license.activityText ?? null,
      activityTextI18n: license.activityTextI18n ?? null,
      isPrimary: license.isPrimary ?? false,
    })),
  };
}

export const CUSTOMERS: readonly {
  id: string;
  name: string;
  externalRef: string;
}[] = CUSTOMER_COUNTERPARTY_SOURCES.map((source) => ({
  id: CUSTOMER_ID_BY_KEY[source.key],
  name: source.name,
  externalRef: source.customerExternalRef,
}));

export const COUNTERPARTIES: readonly SeedCounterpartyFixture[] =
  CUSTOMER_COUNTERPARTY_SOURCES.map((source) => ({
    id: COUNTERPARTY_ID_BY_KEY[source.key],
    customerId: CUSTOMER_ID_BY_KEY[source.key],
    externalRef: source.counterpartyExternalRef,
    shortName: source.shortName,
    fullName: source.fullName,
    kind: source.kind,
    country: source.country,
    profile: toSeedPartyProfileFixture(source.profile, {
      fullName: source.fullName,
      fullNameI18n: source.fullNameI18n ?? null,
      shortName: source.shortName,
      shortNameI18n: source.shortNameI18n ?? null,
      country: source.country,
    }),
  }));

export const ORGANIZATIONS: readonly SeedOrganizationFixture[] = [
  {
    id: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    externalRef: "multihansa-brokers-fzco",
    shortName: "MULTIHANSA BROKERS - FZCO",
    shortNameI18n: {
      ru: "МУЛЬТИХАНСА БРОКЕРЗ-ФЗКО",
      en: "MULTIHANSA BROKERS - FZCO",
    },
    fullName: "MULTIHANSA BROKERS - FZCO",
    fullNameI18n: {
      ru: "МУЛЬТИХАНСА БРОКЕРЗ-ФЗКО",
      en: "MULTIHANSA BROKERS - FZCO",
    },
    description: "Commercial brokers activity (code 4610010).",
    kind: "legal_entity",
    country: "AE",
    orgType: "FZCO",
    orgTypeI18n: {
      ru: "ФЗКО",
      en: "FZCO",
    },
    city: "Dubai",
    cityI18n: {
      ru: "Дубай",
      en: "Dubai",
    },
    address:
      "Building A1, Dubai Digital Park, Dubai Silicon Oasis, Dubai, United Arab Emirates",
    addressI18n: {
      en: "Building A1, Dubai Digital Park, Dubai Silicon Oasis, Dubai, United Arab Emirates",
    },
    inn: "9909738680",
    taxId: "105027720900001",
    kpp: "772587001",
    directorName: "Aleksandrs Zaicevs",
    directorNameI18n: {
      ru: "Александр Зайцев",
      en: "Aleksandrs Zaicevs",
    },
    directorTitle: "Director",
    directorTitleI18n: {
      ru: "Директор",
      en: "Director",
    },
    directorBasis: "Charter",
    directorBasisI18n: {
      ru: "Устав",
      en: "Charter",
    },
    signatureAssetFileName: "multihansa-signature.png",
    sealAssetFileName: "multihansa-seal.png",
  },
  {
    id: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    externalRef: "arabian-fuel-alliance-dmcc",
    shortName: "ARABIAN FUEL ALLIANCE DMCC",
    shortNameI18n: {
      ru: "АРАБИАН ФЬЮЭЛ АЛЛИАНС ДМСС",
      en: "ARABIAN FUEL ALLIANCE DMCC",
    },
    fullName: "ARABIAN FUEL ALLIANCE DMCC",
    fullNameI18n: {
      ru: "АРАБИАН ФЬЮЭЛ АЛЛИАНС ДМСС",
      en: "ARABIAN FUEL ALLIANCE DMCC",
    },
    description: "Commodity trading of refined oil products abroad.",
    kind: "legal_entity",
    country: "AE",
    orgType: "DMCC",
    orgTypeI18n: {
      ru: "ДМСС",
      en: "DMCC",
    },
    city: "Dubai",
    cityI18n: {
      ru: "Дубай",
      en: "Dubai",
    },
    address:
      "Unit No: 2742, DMCC Business Centre, Level No 1, Jewellery & Gemplex 3, Dubai, United Arab Emirates",
    addressI18n: {
      en: "Unit No: 2742, DMCC Business Centre, Level No 1, Jewellery & Gemplex 3, Dubai, United Arab Emirates",
    },
    inn: "9909734358",
    taxId: "104980755300001",
    directorName: "Takhirdzhan Tokhtiev",
    directorNameI18n: {
      ru: "Тахирджан Тохтиев",
      en: "Takhirdzhan Tokhtiev",
    },
    directorTitle: "Director",
    directorTitleI18n: {
      ru: "Директор",
      en: "Director",
    },
    directorBasis: "Charter",
    directorBasisI18n: {
      ru: "Устав",
      en: "Charter",
    },
    signatureAssetFileName: "arabian-fuel-alliance-signature.png",
    sealAssetFileName: "arabian-fuel-alliance-seal.png",
  },
] as const;

export const REQUISITE_PROVIDERS: readonly SeedRequisiteProviderFixture[] = [
  {
    id: REQUISITE_PROVIDER_IDS.GAZPROMBANK,
    kind: "bank",
    name: "Gazprombank",
    description: "Settlement bank captured from RUHA customer contracts.",
    country: "RU",
    address: null,
    contact: null,
    bic: "044525823",
    swift: "GAZPRUMM",
  },
  {
    id: REQUISITE_PROVIDER_IDS.ABU_DHABI_COMMERCIAL_BANK,
    kind: "bank",
    name: "Abu Dhabi Commercial Bank",
    description:
      "Business Bay Branch settlement bank for MULTIHANSA BROKERS - FZCO",
    country: "AE",
    address:
      "22nd Floor, Conrad Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates, Branch 265 - Business Bay Branch",
    contact: "https://www.adcb.com/",
    bic: null,
    swift: "ADCBAEAA",
  },
  {
    id: REQUISITE_PROVIDER_IDS.SBERBANK_NORTHWEST,
    kind: "bank",
    name: "PJSC Sberbank, North-West Bank",
    description: "North-West Sberbank branch used by individual customer contracts.",
    country: "RU",
    address: "191124, Saint Petersburg, Krasnogo Tekstilshchika Street, 2",
    contact: null,
    bic: "044030653",
    swift: "SABRRU2P",
  },
  {
    id: REQUISITE_PROVIDER_IDS.BANK_TOCHKA,
    kind: "bank",
    name: 'ООО "Банк Точка"',
    description: "Settlement bank captured from the Coinex contract.",
    country: "RU",
    address: null,
    contact: null,
    bic: "044525104",
    swift: null,
  },
  {
    id: REQUISITE_PROVIDER_IDS.EXPOBANK,
    kind: "bank",
    name: 'AO "Expobank"',
    description:
      "RUB settlement bank for MULTIHANSA BROKERS - FZCO and Xintatrade.",
    country: "RU",
    address: "115054, Moscow, Kosmodamianskaya Embankment, 52, building 7",
    contact: null,
    bic: "044525460",
    swift: null,
  },
  {
    id: REQUISITE_PROVIDER_IDS.EXI_BANK,
    kind: "bank",
    name: "EXI-Bank",
    description:
      "Settlement bank used by MULTIHANSA BROKERS - FZCO and ARABIAN FUEL ALLIANCE DMCC",
    country: "RU",
    address: "54/4B Maly Prospekt V.O., Saint Petersburg, 199178, Russia",
    contact: null,
    bic: "044030889",
    swift: "JXIBRU2P",
  },
  {
    id: REQUISITE_PROVIDER_IDS.VTB_BANK,
    kind: "bank",
    name: 'Филиал "Центральный" Банка ВТБ (ПАО)',
    description:
      "VTB Central Branch used by Multimodal, RSI Capital and Prime Trade contracts.",
    country: "RU",
    address: "Russian Federation",
    contact: null,
    bic: "044525411",
    swift: "VTBRRUM2MS2",
  },
  {
    id: REQUISITE_PROVIDER_IDS.DUBAI_ISLAMIC_BANK,
    kind: "bank",
    name: "Dubai Islamic Bank",
    description: "Primary settlement bank for ARABIAN FUEL ALLIANCE DMCC",
    country: "AE",
    address: "P.O. Box 1080, Shaikh Zayed Road Branch, Dubai, United Arab Emirates",
    contact: "Branch Code: 097",
    bic: null,
    swift: "DUIBAEAD",
  },
  {
    id: REQUISITE_PROVIDER_IDS.EMIRATES_ISLAMIC_BANK,
    kind: "bank",
    name: "Emirates Islamic Bank",
    description: "Secondary settlement bank for ARABIAN FUEL ALLIANCE DMCC",
    country: "AE",
    address:
      "I-Rise Towers, C01, 32nd Floor, Barsha Heights, Dubai, United Arab Emirates",
    contact: "Branch Code: 3161",
    bic: null,
    swift: "MEBLAEAD",
  },
  {
    id: REQUISITE_PROVIDER_IDS.SBERBANK_MOSCOW,
    kind: "bank",
    name: "PJSC Sberbank, Moscow",
    description: "Sberbank branch used by ONEY FINANSAL.",
    country: "RU",
    address: "19 Vavilova Street, Moscow, 117997, Russia",
    contact: null,
    bic: "044525225",
    swift: null,
  },
  {
    id: REQUISITE_PROVIDER_IDS.MTS_BANK,
    kind: "bank",
    name: "MTS-BANK PJSC",
    description: "Settlement bank captured from the RSI Capital service agreement.",
    country: "RU",
    address: null,
    contact: null,
    bic: "044525232",
    swift: null,
  },
] as const;

const CUSTOMER_REQUISITES: readonly SeedRequisiteFixture[] =
  CUSTOMER_REQUISITE_SOURCES.map((source) => ({
    id: CUSTOMER_REQUISITE_ID_BY_KEY[source.key],
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_ID_BY_KEY[source.counterpartyKey],
    providerId: PROVIDER_ID_BY_KEY[source.providerKey],
    currencyCode: source.currencyCode,
    kind: source.kind,
    label: source.label,
    beneficiaryName: source.beneficiaryName,
    institutionName: PROVIDER_NAME_BY_KEY[source.providerKey],
    accountNo: source.accountNo ?? null,
    corrAccount: source.corrAccount ?? null,
    iban: source.iban ?? null,
    bic: source.bic ?? null,
    swift: source.swift ?? null,
    bankAddress: source.bankAddress ?? null,
    notes: source.notes ?? null,
    isDefault: source.isDefault ?? false,
  }));

export const REQUISITES: readonly SeedRequisiteFixture[] = [
  {
    id: REQUISITE_IDS.MULTIHANSA_ADCB_USD,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.ABU_DHABI_COMMERCIAL_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Multihansa USD (ADCB)",
    description: "USD settlement account at Abu Dhabi Commercial Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "Abu Dhabi Commercial Bank",
    accountNo: "AE080030014261248920002",
    iban: "AE080030014261248920002",
    swift: "ADCBAEAA",
    bankAddress:
      "22nd Floor, Conrad Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates",
    contact: "info@multihansa.com | +7 987 404 78 88 | +971 54 246 64 37",
    notes: "Registration no. 61499; license 63983.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_ADCB_AED,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.ABU_DHABI_COMMERCIAL_BANK,
    currencyCode: "AED",
    kind: "bank",
    label: "Multihansa AED (ADCB)",
    description: "AED settlement account at Abu Dhabi Commercial Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "Abu Dhabi Commercial Bank",
    accountNo: "AE350030014261248920001",
    iban: "AE350030014261248920001",
    swift: "ADCBAEAA",
    bankAddress:
      "22nd Floor, Conrad Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates",
    contact: "info@multihansa.com | +7 987 404 78 88 | +971 54 246 64 37",
    notes: "Registration no. 61499; license 63983.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_EXPOBANK_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.EXPOBANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (Expobank)",
    description: 'RUB settlement account at AO "Expobank"',
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: 'AO "Expobank"',
    accountNo: "40807810001010172279",
    corrAccount: "30101810345250000460",
    bic: "044525460",
    bankAddress: "115054, Moscow, Kosmodamianskaya Embankment, 52, building 7",
    contact: "info@multihansa.com | +7 987 404 78 88 | +971 54 246 64 37",
    notes: "INN 9909738680; KPP 772587001.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_EXI_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.EXI_BANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (EXI-Bank)",
    description: "RUB settlement account at EXI-Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "EXI-Bank",
    accountNo: "40807810700000008369",
    corrAccount: "30101810400000000889",
    bic: "044030889",
    swift: "JXIBRU2P",
    bankAddress: "54/4B Maly Prospekt V.O., Saint Petersburg, 199178, Russia",
    contact: "info@multihansa.com | +7 987 404 78 88 | +971 54 246 64 37",
    notes: "Additional RUB settlement account.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_EXI_AED,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.EXI_BANK,
    currencyCode: "AED",
    kind: "bank",
    label: "Multihansa AED (EXI-Bank)",
    description: "AED settlement account at EXI-Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "EXI-Bank",
    accountNo: "40807784100000000022",
    corrAccount: "30101810400000000889",
    bic: "044030889",
    swift: "JXIBRU2P",
    bankAddress: "54/4B Maly Prospekt V.O., Saint Petersburg, 199178, Russia",
    contact: "info@multihansa.com | +7 987 404 78 88 | +971 54 246 64 37",
    notes: "Additional AED settlement account.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_VTB_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.VTB_BANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (VTB)",
    description: "RUB settlement account at VTB Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: 'Филиал "Центральный" Банка ВТБ (ПАО)',
    accountNo: "40807810800810009185",
    corrAccount: "30101810145250000411",
    bic: "044525411",
    bankAddress: "Russian Federation",
    contact: "info@multihansa.com | +7 987 404 78 88 | +971 54 246 64 37",
    notes: "Additional RUB settlement account.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.MULTIHANSA_MTS_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
    providerId: REQUISITE_PROVIDER_IDS.MTS_BANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (MTS Bank)",
    description: "RUB settlement account at MTS-BANK PJSC",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "MTS-BANK PJSC",
    accountNo: "40807810500009000553",
    corrAccount: "30101810600000000232",
    bic: "044525232",
    notes: "Captured from договор 05.12.pdf.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_DIB_AED,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.DUBAI_ISLAMIC_BANK,
    currencyCode: "AED",
    kind: "bank",
    label: "Arabian Fuel Alliance AED (Dubai Islamic)",
    description: "AED settlement account at Dubai Islamic Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "Dubai Islamic Bank",
    accountNo: "AE260240097520177404101",
    iban: "AE260240097520177404101",
    swift: "DUIBAEAD",
    bankAddress:
      "P.O. Box 1080, Shaikh Zayed Road Branch, Dubai, United Arab Emirates",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Registration no. DMCC199265; account no. 432621.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_DIB_USD,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.DUBAI_ISLAMIC_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Arabian Fuel Alliance USD (Dubai Islamic)",
    description: "USD settlement account at Dubai Islamic Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "Dubai Islamic Bank",
    accountNo: "AE780240097521177404101",
    iban: "AE780240097521177404101",
    swift: "DUIBAEAD",
    bankAddress:
      "P.O. Box 1080, Shaikh Zayed Road Branch, Dubai, United Arab Emirates",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Registration no. DMCC199265; account no. 432621.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_DIB_EUR,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.DUBAI_ISLAMIC_BANK,
    currencyCode: "EUR",
    kind: "bank",
    label: "Arabian Fuel Alliance EUR (Dubai Islamic)",
    description: "EUR settlement account at Dubai Islamic Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "Dubai Islamic Bank",
    accountNo: "AE510240097521177404102",
    iban: "AE510240097521177404102",
    swift: "DUIBAEAD",
    bankAddress:
      "P.O. Box 1080, Shaikh Zayed Road Branch, Dubai, United Arab Emirates",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Registration no. DMCC199265; account no. 432621.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EMIRATES_AED,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.EMIRATES_ISLAMIC_BANK,
    currencyCode: "AED",
    kind: "bank",
    label: "Arabian Fuel Alliance AED (Emirates Islamic)",
    description: "AED settlement account at Emirates Islamic Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "Emirates Islamic Bank",
    accountNo: "AE310340003708499273501",
    iban: "AE310340003708499273501",
    swift: "MEBLAEAD",
    bankAddress:
      "I-Rise Towers, C01, 32nd Floor, Barsha Heights, Dubai, United Arab Emirates",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Secondary AED settlement account.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EMIRATES_USD,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.EMIRATES_ISLAMIC_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Arabian Fuel Alliance USD (Emirates Islamic)",
    description: "USD settlement account at Emirates Islamic Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "Emirates Islamic Bank",
    accountNo: "AE040340003708499273502",
    iban: "AE040340003708499273502",
    swift: "MEBLAEAD",
    bankAddress:
      "I-Rise Towers, C01, 32nd Floor, Barsha Heights, Dubai, United Arab Emirates",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Secondary USD settlement account.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EXI_RUB,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.EXI_BANK,
    currencyCode: "RUB",
    kind: "bank",
    label: "Arabian Fuel Alliance RUB (EXI-Bank)",
    description: "RUB settlement account at EXI-Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "EXI-Bank",
    accountNo: "40807810800000008366",
    corrAccount: "30101810400000000889",
    bic: "044030889",
    swift: "JXIBRU2P",
    bankAddress: "54/4B Maly Prospekt V.O., Saint Petersburg, 199178, Russia",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "EXI-Bank RUB settlement account.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EXI_AED,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    providerId: REQUISITE_PROVIDER_IDS.EXI_BANK,
    currencyCode: "AED",
    kind: "bank",
    label: "Arabian Fuel Alliance AED (EXI-Bank)",
    description: "AED settlement account at EXI-Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "EXI-Bank",
    accountNo: "40807784800000000021",
    corrAccount: "30101810400000000889",
    bic: "044030889",
    swift: "JXIBRU2P",
    bankAddress: "54/4B Maly Prospekt V.O., Saint Petersburg, 199178, Russia",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Additional AED settlement account.",
    isDefault: false,
  },
  ...CUSTOMER_REQUISITES,
] as const;

export const AGREEMENTS: readonly SeedAgreementFixture[] =
  CUSTOMER_CONTRACT_INVENTORY.map((contract) => ({
    key: contract.key,
    customerId: CUSTOMER_ID_BY_KEY[contract.customerKey],
    organizationId: ORGANIZATION_ID_BY_KEY[contract.organizationKey],
    organizationRequisiteId:
      ORGANIZATION_REQUISITE_ID_BY_KEY[contract.organizationRequisiteKey],
    contractNumber: contract.contractNumber,
    contractDate: contract.contractDate,
    isActive: contract.isActive,
    contractKind: contract.contractKind,
    extractionMode: contract.extractionMode,
    sourcePdfFile: contract.pdfFile,
    feeRules: contract.feeRules ?? [],
    notes: contract.notes ?? null,
  }));
