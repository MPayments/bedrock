import {
  CUSTOMER_CONTRACT_INVENTORY,
  CUSTOMER_COUNTERPARTY_SOURCES,
  CUSTOMER_REQUISITE_SOURCES,
  type CounterpartyProfileSource,
  type CustomerContractOrganizationKey,
  type CustomerContractOrganizationRequisiteKey,
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
  UEXPO_LOJISTIK: "00000000-0000-4000-8000-000000000211",
  ASHON_INTERNATIONAL: "00000000-0000-4000-8000-000000000212",
  CARBONPRO: "00000000-0000-4000-8000-000000000213",
  FAHR_ENERGY: "00000000-0000-4000-8000-000000000214",
  BARNAVA_TRADING: "00000000-0000-4000-8000-000000000215",
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
  UEXPO_LOJISTIK: "00000000-0000-4000-8000-000000000312",
  ASHON_INTERNATIONAL: "00000000-0000-4000-8000-000000000313",
  CARBONPRO: "00000000-0000-4000-8000-000000000314",
  FAHR_ENERGY: "00000000-0000-4000-8000-000000000315",
  BARNAVA_TRADING: "00000000-0000-4000-8000-000000000316",
} as const;

export const ORGANIZATION_IDS = {
  MULTIHANSA_BROKERS: "00000000-0000-4000-8000-000000000310",
  ARABIAN_FUEL_ALLIANCE: "00000000-0000-4000-8000-000000000320",
  BINTANG_UTARA_TRADING: "00000000-0000-4000-8000-000000000330",
} as const;

export const REQUISITE_PROVIDER_IDS = {
  ABU_DHABI_COMMERCIAL_BANK: "00000000-0000-4000-8000-000000000402",
  DUBAI_ISLAMIC_BANK: "00000000-0000-4000-8000-000000000408",
  EMIRATES_ISLAMIC_BANK: "00000000-0000-4000-8000-000000000409",
  ZHEJIANG_CHOUZHOU_COMMERCIAL_BANK:
    "00000000-0000-4000-8000-000000000410",
  UNITED_BANK_LIMITED: "00000000-0000-4000-8000-000000000411",
  BANK_NEGARA_INDONESIA: "00000000-0000-4000-8000-000000000412",
  BANK_MANDIRI: "00000000-0000-4000-8000-000000000413",
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
  UEXPO_RUB_TBANK: "00000000-0000-4000-8000-000000000557",
  ASHON_USD_ZHEJIANG_CHOUZHOU: "00000000-0000-4000-8000-000000000558",
  ASHON_CNY_ZHEJIANG_CHOUZHOU: "00000000-0000-4000-8000-000000000559",
  CARBONPRO_RUB_EXPOBANK: "00000000-0000-4000-8000-000000000560",
  CARBONPRO_USD_EXPOBANK: "00000000-0000-4000-8000-000000000561",
  CARBONPRO_CNY_EXPOBANK: "00000000-0000-4000-8000-000000000562",
  FAHR_RUB_SLAVIA: "00000000-0000-4000-8000-000000000563",
  BARNAVA_AED_UNITED_BANK: "00000000-0000-4000-8000-000000000564",
  BINTANG_BNI_IDR: "00000000-0000-4000-8000-000000000565",
  BINTANG_BNI_USD: "00000000-0000-4000-8000-000000000566",
  BINTANG_BNI_EUR: "00000000-0000-4000-8000-000000000567",
  BINTANG_BNI_JPY: "00000000-0000-4000-8000-000000000568",
  BINTANG_BNI_KRW: "00000000-0000-4000-8000-000000000569",
  BINTANG_MANDIRI_USD: "00000000-0000-4000-8000-000000000570",
  BINTANG_MANDIRI_IDR: "00000000-0000-4000-8000-000000000571",
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
  uexpo_lojistik: CUSTOMER_IDS.UEXPO_LOJISTIK,
  ashon_international: CUSTOMER_IDS.ASHON_INTERNATIONAL,
  carbonpro: CUSTOMER_IDS.CARBONPRO,
  fahr_energy: CUSTOMER_IDS.FAHR_ENERGY,
  barnava_trading: CUSTOMER_IDS.BARNAVA_TRADING,
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
  uexpo_lojistik: COUNTERPARTY_IDS.UEXPO_LOJISTIK,
  ashon_international: COUNTERPARTY_IDS.ASHON_INTERNATIONAL,
  carbonpro: COUNTERPARTY_IDS.CARBONPRO,
  fahr_energy: COUNTERPARTY_IDS.FAHR_ENERGY,
  barnava_trading: COUNTERPARTY_IDS.BARNAVA_TRADING,
};

const ORGANIZATION_ID_BY_KEY: Record<CustomerContractOrganizationKey, string> = {
  multihansa_brokers: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
  arabian_fuel_alliance: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
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
  legalName: string;
  legalNameI18n?: SeedLocaleTextMap;
  displayName: string;
  displayNameI18n?: SeedLocaleTextMap;
  description?: string | null;
  country: string | null;
  address?: string | null;
  addressI18n?: SeedLocaleTextMap;
  contact?: string | null;
  bic?: string | null;
  swift?: string | null;
  corrAccount?: string | null;
}

export interface SeedRequisiteFixture {
  id: string;
  ownerType: "organization" | "counterparty";
  ownerId: string;
  providerId?: string;
  providerBic?: string;
  currencyCode: string;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  label: string;
  description?: string | null;
  beneficiaryName?: string | null;
  institutionName?: string | null;
  accountNo?: string | null;
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
  {
    id: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    externalRef: "pt-bintang-utara-trading",
    shortName: "PT BINTANG UTARA TRADING",
    shortNameI18n: {
      en: "PT BINTANG UTARA TRADING",
    },
    fullName: "PT BINTANG UTARA TRADING",
    fullNameI18n: {
      en: "PT BINTANG UTARA TRADING",
    },
    description:
      "Foreign investment company in Indonesia engaged in wholesale trading, land transport equipment trading, construction materials trading, management consulting, and advertising activities under KBLI 46100, 46411, 46412, 46414, 46419, 46593, 46631, 46639, 46699, 46900, 70209, and 73100.",
    kind: "legal_entity",
    country: "ID",
    orgType: "PT PMA",
    orgTypeI18n: {
      en: "PT PMA",
    },
    city: "Badung",
    cityI18n: {
      en: "Badung",
    },
    address:
      "Jl. Dewi Sri I, No. 20, Legian, Kuta, Kabupaten Badung, Bali, Indonesia",
    addressI18n: {
      en: "Jl. Dewi Sri I, No. 20, Legian, Kuta, Kabupaten Badung, Bali, Indonesia",
    },
    directorName: "Ni Ketut Rai Swaryani Dewi",
    directorNameI18n: {
      en: "Ni Ketut Rai Swaryani Dewi",
    },
    directorTitle: "Direktur",
    directorTitleI18n: {
      en: "Director",
    },
    directorBasis: "Akta Nomor 005 tanggal 10 Maret 2026",
    directorBasisI18n: {
      en: "Deed No. 005 dated March 10, 2026",
    },
  },
] as const;

export const REQUISITE_PROVIDERS: readonly SeedRequisiteProviderFixture[] = [
  {
    id: REQUISITE_PROVIDER_IDS.ABU_DHABI_COMMERCIAL_BANK,
    kind: "bank",
    legalName: "Abu Dhabi Commercial Bank",
    legalNameI18n: {
      en: "Abu Dhabi Commercial Bank",
      ru: "Абу-Даби Коммершиал Банк",
    },
    displayName: "Abu Dhabi Commercial Bank",
    displayNameI18n: {
      en: "Abu Dhabi Commercial Bank",
      ru: "Абу-Даби Коммершиал Банк",
    },
    description:
      "Business Bay Branch settlement bank for MULTIHANSA BROKERS - FZCO",
    country: "AE",
    address:
      "22nd Floor, Conrad Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates, Branch 265 - Business Bay Branch",
    addressI18n: {
      en: "22nd Floor, Conrad Business Tower, Sheikh Zayed Road, Dubai, United Arab Emirates, Branch 265 - Business Bay Branch",
      ru: "22-й этаж, Conrad Business Tower, Sheikh Zayed Road, Дубай, Объединенные Арабские Эмираты, филиал 265 - Business Bay Branch",
    },
    contact: "https://www.adcb.com/",
    bic: null,
    swift: "ADCBAEAA",
  },
  {
    id: REQUISITE_PROVIDER_IDS.DUBAI_ISLAMIC_BANK,
    kind: "bank",
    legalName: "Dubai Islamic Bank",
    legalNameI18n: {
      en: "Dubai Islamic Bank",
      ru: "Дубай Исламик Банк",
    },
    displayName: "Dubai Islamic Bank",
    displayNameI18n: {
      en: "Dubai Islamic Bank",
      ru: "Дубай Исламик Банк",
    },
    description: "Primary settlement bank for ARABIAN FUEL ALLIANCE DMCC",
    country: "AE",
    address: "P.O. Box 1080, Shaikh Zayed Road Branch, Dubai, United Arab Emirates",
    addressI18n: {
      en: "P.O. Box 1080, Shaikh Zayed Road Branch, Dubai, United Arab Emirates",
      ru: "P.O. Box 1080, филиал Shaikh Zayed Road, Дубай, Объединенные Арабские Эмираты",
    },
    contact: "Branch Code: 097",
    bic: null,
    swift: "DUIBAEAD",
  },
  {
    id: REQUISITE_PROVIDER_IDS.EMIRATES_ISLAMIC_BANK,
    kind: "bank",
    legalName: "Emirates Islamic Bank",
    legalNameI18n: {
      en: "Emirates Islamic Bank",
      ru: "Эмирейтс Исламик Банк",
    },
    displayName: "Emirates Islamic Bank",
    displayNameI18n: {
      en: "Emirates Islamic Bank",
      ru: "Эмирейтс Исламик Банк",
    },
    description: "Secondary settlement bank for ARABIAN FUEL ALLIANCE DMCC",
    country: "AE",
    address:
      "I-Rise Towers, C01, 32nd Floor, Barsha Heights, Dubai, United Arab Emirates",
    addressI18n: {
      en: "I-Rise Towers, C01, 32nd Floor, Barsha Heights, Dubai, United Arab Emirates",
      ru: "I-Rise Towers, C01, 32-й этаж, Barsha Heights, Дубай, Объединенные Арабские Эмираты",
    },
    contact: "Branch Code: 3161",
    bic: null,
    swift: "MEBLAEAD",
  },
  {
    id: REQUISITE_PROVIDER_IDS.ZHEJIANG_CHOUZHOU_COMMERCIAL_BANK,
    kind: "bank",
    legalName: "Zhejiang Chouzhou Commercial Bank",
    legalNameI18n: {
      en: "Zhejiang Chouzhou Commercial Bank",
      ru: "Чжэцзян Чоучжоу Коммершиал Банк",
    },
    displayName: "Zhejiang Chouzhou Commercial Bank",
    displayNameI18n: {
      en: "Zhejiang Chouzhou Commercial Bank",
      ru: "Чжэцзян Чоучжоу Коммершиал Банк",
    },
    description:
      "Provider inferred from SWIFT ZJCBCN2N on the Ashon International account card.",
    country: "CN",
    address: null,
    addressI18n: null,
    contact: null,
    bic: null,
    swift: "ZJCBCN2N",
  },
  {
    id: REQUISITE_PROVIDER_IDS.UNITED_BANK_LIMITED,
    kind: "bank",
    legalName: "United Bank Limited",
    legalNameI18n: {
      en: "United Bank Limited",
      ru: "Юнайтед Банк Лимитед",
    },
    displayName: "United Bank Limited",
    displayNameI18n: {
      en: "United Bank Limited",
      ru: "Юнайтед Банк Лимитед",
    },
    description:
      "Settlement bank shown on the Barnava Trading FZCO account information card.",
    country: "AE",
    address: null,
    addressI18n: null,
    contact: null,
    bic: null,
    swift: "UNILAEADXXX",
  },
  {
    id: REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
    kind: "bank",
    legalName: "PT Bank Negara Indonesia (Persero) Tbk",
    legalNameI18n: {
      en: "PT Bank Negara Indonesia (Persero) Tbk",
    },
    displayName: "Bank BNI",
    displayNameI18n: {
      en: "Bank BNI",
    },
    description:
      "BNI Karangasem sub-branch settlement bank for PT BINTANG UTARA TRADING.",
    country: "ID",
    address: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    addressI18n: {
      en: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    },
    contact: null,
    bic: null,
    swift: "BNINIDJASGR",
  },
  {
    id: REQUISITE_PROVIDER_IDS.BANK_MANDIRI,
    kind: "bank",
    legalName: "PT Bank Mandiri (Persero) Tbk",
    legalNameI18n: {
      en: "PT Bank Mandiri (Persero) Tbk",
    },
    displayName: "Bank Mandiri",
    displayNameI18n: {
      en: "Bank Mandiri",
    },
    description:
      "Bank Mandiri Denpasar Udayana settlement bank for PT BINTANG UTARA TRADING.",
    country: "ID",
    address:
      "Kecamatan Denpasar Udayana, Jl. Udayana No. 11, Denpasar, Indonesia",
    addressI18n: {
      en: "Kecamatan Denpasar Udayana, Jl. Udayana No. 11, Denpasar, Indonesia",
    },
    contact: null,
    bic: null,
    swift: "BMRIIDJAXXX",
  },
] as const;

const CUSTOMER_REQUISITES: readonly SeedRequisiteFixture[] =
  CUSTOMER_REQUISITE_SOURCES.map((source) => {
    if (!source.bic) {
      throw new Error(
        `[fixtures] CUSTOMER_REQUISITE_SOURCES entry ${source.key} must declare a bic to resolve its provider from the CBR directory`,
      );
    }
    return {
      id: CUSTOMER_REQUISITE_ID_BY_KEY[source.key],
      ownerType: "counterparty" as const,
      ownerId: COUNTERPARTY_ID_BY_KEY[source.counterpartyKey],
      providerBic: source.bic,
      currencyCode: source.currencyCode,
      kind: source.kind,
      label: source.label,
      beneficiaryName: source.beneficiaryName,
      accountNo: source.accountNo ?? null,
      iban: source.iban ?? null,
      bic: source.bic,
      swift: source.swift ?? null,
      bankAddress: source.bankAddress ?? null,
      notes: source.notes ?? null,
      isDefault: source.isDefault ?? false,
    };
  });

const IMAGE_COUNTERPARTY_REQUISITES: readonly SeedRequisiteFixture[] = [
  {
    id: REQUISITE_IDS.UEXPO_RUB_TBANK,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.UEXPO_LOJISTIK,
    providerBic: "044525113",
    currencyCode: "RUB",
    kind: "bank",
    label: "Uexpo RUB (TBank)",
    beneficiaryName: "UEXPO LOJISTIK SANAYI TICARET LIMITED SIRKETI",
    institutionName: 'Rosbank Moscow branch of JSC "TBank"',
    accountNo: "40807810587360000415",
    bic: "044525113",
    swift: "TICSRUMMXXX",
    bankAddress:
      "123112, Moscow, Presnensky municipal district, 1st Krasnogvardeisky passage, 19",
    notes: "Correspondent account: 30101810545374525113.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ASHON_USD_ZHEJIANG_CHOUZHOU,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.ASHON_INTERNATIONAL,
    providerId: REQUISITE_PROVIDER_IDS.ZHEJIANG_CHOUZHOU_COMMERCIAL_BANK,
    currencyCode: "USD",
    kind: "bank",
    label: "Ashon USD (Zhejiang Chouzhou)",
    beneficiaryName: "Ashon International DMSS",
    institutionName: "Zhejiang Chouzhou Commercial Bank",
    accountNo: "FTN29004099910071416",
    swift: "ZJCBCN2N",
    notes:
      "USD correspondents: JPMorgan Chase Bank, N.A., New York (CHASUS33); Wells Fargo Bank, N.A., New York (PNBPUS3NNYC).",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.ASHON_CNY_ZHEJIANG_CHOUZHOU,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.ASHON_INTERNATIONAL,
    providerId: REQUISITE_PROVIDER_IDS.ZHEJIANG_CHOUZHOU_COMMERCIAL_BANK,
    currencyCode: "CNY",
    kind: "bank",
    label: "Ashon CNY (Zhejiang Chouzhou)",
    beneficiaryName: "Ashon International DMSS",
    institutionName: "Zhejiang Chouzhou Commercial Bank",
    accountNo: "FTN29004099910071416",
    swift: "ZJCBCN2N",
    notes:
      "CNY correspondents: Bank of China Zhejiang Branch (BKCHCNBJ910); Shanghai Pudong Development Bank Hangzhou Branch (SPDBCNSH336).",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.CARBONPRO_RUB_EXPOBANK,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.CARBONPRO,
    providerBic: "044525460",
    currencyCode: "RUB",
    kind: "bank",
    label: "CarbonPro RUB (Expobank)",
    beneficiaryName: "Carbonpro LLC / OOO «КарбонПро»",
    institutionName: "Expobank JSC",
    accountNo: "40702810101360166846",
    bic: "044525460",
    swift: "EXPNRUMMXXX",
    notes: "RUB account confirmed on the dedicated CarbonPro account snippet.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.CARBONPRO_USD_EXPOBANK,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.CARBONPRO,
    providerBic: "044525460",
    currencyCode: "USD",
    kind: "bank",
    label: "CarbonPro USD (Expobank)",
    beneficiaryName: "Carbonpro LLC / OOO «КарбонПро»",
    institutionName: "Expobank JSC",
    accountNo: "40702840401360166846",
    bic: "044525460",
    swift: "EXPNRUMMXXX",
    notes: "Source card labels this as the USD transit account.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.CARBONPRO_CNY_EXPOBANK,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.CARBONPRO,
    providerBic: "044525460",
    currencyCode: "CNY",
    kind: "bank",
    label: "CarbonPro CNY (Expobank)",
    beneficiaryName: "Carbonpro LLC / OOO «КарбонПро»",
    institutionName: "Expobank JSC",
    accountNo: "40702156001360166846",
    bic: "044525460",
    swift: "EXPNRUMMXXX",
    notes: "Current CNY account; transit CNY account 40702156701369166846 is also listed on the source card.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.FAHR_RUB_SLAVIA,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.FAHR_ENERGY,
    providerBic: "044030742",
    currencyCode: "RUB",
    kind: "bank",
    label: "Fahr Energy RUB (Slavia)",
    beneficiaryName: "FAHR ENERGY DMCC",
    institutionName: 'Branch of AKB "Slavia" (JSC) in Saint Petersburg',
    accountNo: "40807810300050000036",
    bic: "044030742",
    notes: "Correspondent account: 30101810140300000742.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.BARNAVA_AED_UNITED_BANK,
    ownerType: "counterparty",
    ownerId: COUNTERPARTY_IDS.BARNAVA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.UNITED_BANK_LIMITED,
    currencyCode: "AED",
    kind: "bank",
    label: "Barnava AED (United Bank Limited)",
    beneficiaryName: "BARNAVA TRADING FZCO",
    institutionName: "United Bank Limited",
    accountNo: "000200853936",
    iban: "AE890470000000200853936",
    swift: "UNILAEADXXX",
    isDefault: true,
  },
] as const;

const BINTANG_UTARA_REQUISITES: readonly SeedRequisiteFixture[] = [
  {
    id: REQUISITE_IDS.BINTANG_BNI_IDR,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
    currencyCode: "IDR",
    kind: "bank",
    label: "Bintang Utara IDR (BNI)",
    description: "IDR settlement account at Bank BNI",
    beneficiaryName: "PT BINTANG UTARA TRADING",
    institutionName: "Bank BNI",
    accountNo: "2054916367",
    swift: "BNINIDJASGR",
    bankAddress: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    notes:
      "Account address: Jl. Dewi Sri I, No. 20 Desa/Kelurahan Legian, Kecamatan Kuta, Kabupaten Badung, Provinsi Bali.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.BINTANG_BNI_USD,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
    currencyCode: "USD",
    kind: "bank",
    label: "Bintang Utara USD (BNI)",
    description: "USD settlement account at Bank BNI",
    beneficiaryName: "PT BINTANG UTARA TRADING",
    institutionName: "Bank BNI",
    accountNo: "2054917190",
    swift: "BNINIDJASGR",
    bankAddress: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    notes:
      "Account address: Jl. Dewi Sri I, No. 20 Desa/Kelurahan Legian, Kecamatan Kuta, Kabupaten Badung, Provinsi Bali.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.BINTANG_BNI_EUR,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
    currencyCode: "EUR",
    kind: "bank",
    label: "Bintang Utara EUR (BNI)",
    description: "EUR settlement account at Bank BNI",
    beneficiaryName: "PT BINTANG UTARA TRADING",
    institutionName: "Bank BNI",
    accountNo: "2053104764",
    swift: "BNINIDJASGR",
    bankAddress: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    notes:
      "Account address: Jl. Dewi Sri I, No. 20 Desa/Kelurahan Legian, Kecamatan Kuta, Kabupaten Badung, Provinsi Bali.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.BINTANG_BNI_JPY,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
    currencyCode: "JPY",
    kind: "bank",
    label: "Bintang Utara JPY (BNI)",
    description: "JPY settlement account at Bank BNI",
    beneficiaryName: "PT BINTANG UTARA TRADING",
    institutionName: "Bank BNI",
    accountNo: "2053120492",
    swift: "BNINIDJASGR",
    bankAddress: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    notes:
      "Account address: Jl. Dewi Sri I, No. 20 Desa/Kelurahan Legian, Kecamatan Kuta, Kabupaten Badung, Provinsi Bali.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.BINTANG_BNI_KRW,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
    currencyCode: "KRW",
    kind: "bank",
    label: "Bintang Utara KRW (BNI)",
    description: "KRW settlement account at Bank BNI",
    beneficiaryName: "PT BINTANG UTARA TRADING",
    institutionName: "Bank BNI",
    accountNo: "2053137064",
    swift: "BNINIDJASGR",
    bankAddress: "BNI Cabang Singaraja, Capem Karangasem, Bali, Indonesia",
    notes:
      "Account address: Jl. Dewi Sri I, No. 20 Desa/Kelurahan Legian, Kecamatan Kuta, Kabupaten Badung, Provinsi Bali.",
    isDefault: true,
  },
  {
    id: REQUISITE_IDS.BINTANG_MANDIRI_USD,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_MANDIRI,
    currencyCode: "USD",
    kind: "bank",
    label: "Bintang Utara USD (Mandiri)",
    description: "USD settlement account at Bank Mandiri",
    beneficiaryName: "DISCOVERY CANDIDASA COTTAGES AND VILLAS",
    institutionName: "PT Bank Mandiri (Persero) Tbk",
    accountNo: "1450017174208",
    swift: "BMRIIDJAXXX",
    bankAddress:
      "Kecamatan Denpasar Udayana, Jl. Udayana No. 11, Denpasar, Indonesia",
    notes:
      "Account address: Jl. Pantai Indah No. 06 Candidasa, Bugbug - Karangasem, 80811.",
    isDefault: false,
  },
  {
    id: REQUISITE_IDS.BINTANG_MANDIRI_IDR,
    ownerType: "organization",
    ownerId: ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
    providerId: REQUISITE_PROVIDER_IDS.BANK_MANDIRI,
    currencyCode: "IDR",
    kind: "bank",
    label: "Bintang Utara IDR (Mandiri)",
    description: "IDR settlement account at Bank Mandiri",
    beneficiaryName: "DISCOVERY CANDIDASA COTTAGES AND VILLAS",
    institutionName: "PT Bank Mandiri (Persero) Tbk",
    accountNo: "1450017124229",
    swift: "BMRIIDJAXXX",
    bankAddress:
      "Kecamatan Denpasar Udayana, Jl. Udayana No. 11, Denpasar, Indonesia",
    notes:
      "Account address: Jl. Pantai Indah No. 06 Candidasa, Bugbug - Karangasem, 80811.",
    isDefault: false,
  },
] as const;

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
    providerBic: "044525460",
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (Expobank)",
    description: 'RUB settlement account at AO "Expobank"',
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: 'AO "Expobank"',
    accountNo: "40807810001010172279",
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
    providerBic: "044030889",
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (EXI-Bank)",
    description: "RUB settlement account at EXI-Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "EXI-Bank",
    accountNo: "40807810700000008369",
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
    providerBic: "044030889",
    currencyCode: "AED",
    kind: "bank",
    label: "Multihansa AED (EXI-Bank)",
    description: "AED settlement account at EXI-Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "EXI-Bank",
    accountNo: "40807784100000000022",
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
    providerBic: "044525411",
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (VTB)",
    description: "RUB settlement account at VTB Bank",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: 'Филиал "Центральный" Банка ВТБ (ПАО)',
    accountNo: "40807810800810009185",
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
    providerBic: "044525232",
    currencyCode: "RUB",
    kind: "bank",
    label: "Multihansa RUB (MTS Bank)",
    description: "RUB settlement account at MTS-BANK PJSC",
    beneficiaryName: "MULTIHANSA BROKERS - FZCO",
    institutionName: "MTS-BANK PJSC",
    accountNo: "40807810500009000553",
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
    providerBic: "044030889",
    currencyCode: "RUB",
    kind: "bank",
    label: "Arabian Fuel Alliance RUB (EXI-Bank)",
    description: "RUB settlement account at EXI-Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "EXI-Bank",
    accountNo: "40807810800000008366",
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
    providerBic: "044030889",
    currencyCode: "AED",
    kind: "bank",
    label: "Arabian Fuel Alliance AED (EXI-Bank)",
    description: "AED settlement account at EXI-Bank",
    beneficiaryName: "ARABIAN FUEL ALLIANCE DMCC",
    institutionName: "EXI-Bank",
    accountNo: "40807784800000000021",
    bic: "044030889",
    swift: "JXIBRU2P",
    bankAddress: "54/4B Maly Prospekt V.O., Saint Petersburg, 199178, Russia",
    contact: "CONTACT@AFALLIANCE.XYZ | +79874047888 | Afalliance.xyz",
    notes: "Additional AED settlement account.",
    isDefault: false,
  },
  ...CUSTOMER_REQUISITES,
  ...IMAGE_COUNTERPARTY_REQUISITES,
  ...BINTANG_UTARA_REQUISITES,
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
