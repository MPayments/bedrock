export type CustomerCounterpartyKey =
  | "ruha_trade"
  | "multimodal_logistics_center"
  | "semen_shakshin"
  | "hongkong_xintatrade"
  | "moskva_amros"
  | "vidi_technolab"
  | "rsi_capital"
  | "oney_finansal"
  | "prime_trade"
  | "coinex";

export type CustomerContractOrganizationKey =
  | "multihansa_brokers"
  | "arabian_fuel_alliance";

export type CustomerContractProviderKey =
  | "gazprombank"
  | "sberbank_northwest"
  | "sberbank_moscow"
  | "bank_tochka"
  | "mts_bank"
  | "expobank"
  | "vtb_bank";

export type CustomerContractOrganizationRequisiteKey =
  | "multihansa_exi_rub"
  | "multihansa_mts_rub"
  | "arabian_exi_rub";

export type CustomerContractRequisiteKey =
  | "ruha_rub_gazprombank"
  | "ruha_try_gazprombank"
  | "multimodal_rub_vtb"
  | "shakshin_rub_sberbank"
  | "xintatrade_rub_expobank"
  | "oney_rub_sberbank"
  | "prime_trade_rub_vtb"
  | "rsi_capital_rub_vtb"
  | "coinex_rub_bank_tochka";

export interface CounterpartyProfileSource {
  legalFormLabelI18n?: Record<string, string | null> | null;
  legalFormCode?: string | null;
  legalFormLabel?: string | null;
  businessActivityText?: string | null;
  businessActivityTextI18n?: Record<string, string | null> | null;
  identifiers?: readonly {
    scheme: string;
    value: string;
  }[];
  address?: {
    countryCode?: string | null;
    postalCode?: string | null;
    city?: string | null;
    cityI18n?: Record<string, string | null> | null;
    streetAddress?: string | null;
    streetAddressI18n?: Record<string, string | null> | null;
    addressDetails?: string | null;
    addressDetailsI18n?: Record<string, string | null> | null;
    fullAddress?: string | null;
    fullAddressI18n?: Record<string, string | null> | null;
  } | null;
  contacts?: readonly {
    type: "email" | "phone" | "website" | "fax" | "other";
    value: string;
    isPrimary?: boolean;
  }[];
  representatives?: readonly {
    role: "director" | "signatory" | "contact" | "authorized_person" | "other";
    fullName: string;
    fullNameI18n?: Record<string, string | null> | null;
    title?: string | null;
    titleI18n?: Record<string, string | null> | null;
    basisDocument?: string | null;
    basisDocumentI18n?: Record<string, string | null> | null;
    isPrimary?: boolean;
  }[];
  licenses?: readonly {
    type:
      | "company_license"
      | "broker_license"
      | "financial_service_license"
      | "trade_license"
      | "customs_license"
      | "other";
    number: string;
    issuer?: string | null;
    issuerI18n?: Record<string, string | null> | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    activityText?: string | null;
    activityTextI18n?: Record<string, string | null> | null;
    isPrimary?: boolean;
  }[];
}

export interface CustomerCounterpartySource {
  key: CustomerCounterpartyKey;
  name: string;
  customerExternalRef: string;
  counterpartyExternalRef: string;
  shortName: string;
  shortNameI18n?: Record<string, string | null> | null;
  fullName: string;
  fullNameI18n?: Record<string, string | null> | null;
  kind: "legal_entity" | "individual";
  country: string | null;
  profile: CounterpartyProfileSource;
}

export interface CustomerRequisiteSource {
  key: CustomerContractRequisiteKey;
  counterpartyKey: CustomerCounterpartyKey;
  providerKey: CustomerContractProviderKey;
  currencyCode: string;
  kind: "bank";
  label: string;
  beneficiaryName: string;
  accountNo?: string | null;
  corrAccount?: string | null;
  iban?: string | null;
  bic?: string | null;
  swift?: string | null;
  bankAddress?: string | null;
  notes?: string | null;
  isDefault?: boolean;
}

export interface CustomerContractInventoryEntry {
  key: string;
  pdfFile: string;
  extractionMode: "pdftotext" | "ocr";
  contractKind:
    | "agency_agreement"
    | "service_agreement"
    | "sale_purchase_agreement";
  contractNumber: string;
  contractDate: string;
  customerKey: CustomerCounterpartyKey;
  organizationKey: CustomerContractOrganizationKey;
  organizationRequisiteKey: CustomerContractOrganizationRequisiteKey;
  isActive: boolean;
  feeRules?: readonly {
    kind: "agent_fee" | "fixed_fee";
    unit: "bps" | "money";
    value: string;
  }[];
  capturedCounterpartyRequisites?: readonly CustomerContractRequisiteKey[];
  notes?: string | null;
}

export const CUSTOMER_COUNTERPARTY_SOURCES: readonly CustomerCounterpartySource[] =
  [
    {
      key: "ruha_trade",
      name: "RUHA TRADE ITHALAT IHRACAT VE DANISMANLIK LIMITED SIRKETI",
      customerExternalRef: "ruha-trade",
      counterpartyExternalRef: "ruha-trade-ithalat-ihracat",
      shortName: "RUHA TRADE",
      shortNameI18n: {
        ru: "РУХА ТРЕЙД",
        en: "RUHA TRADE",
      },
      fullName:
        "RUHA TRADE ITHALAT IHRACAT VE DANISMANLIK LIMITED SIRKETI",
      fullNameI18n: {
        ru: "РУХА ТРЕЙД ИТАЛАТ ИХРАДЖАТ ВЭ ДАНЫШМАНЛЫК ЛИМИТЕД ШИРКЕТИ",
        en: "RUHA TRADE ITHALAT IHRACAT VE DANISMANLIK LIMITED SIRKETI",
      },
      kind: "legal_entity",
      country: "TR",
      profile: {
        identifiers: [
          { scheme: "inn", value: "7744001497" },
          { scheme: "kpp", value: "772801001" },
        ],
        address: {
          countryCode: "TR",
          city: "Istanbul",
          cityI18n: {
            ru: "Стамбул",
            en: "Istanbul",
          },
          fullAddress:
            "Türkiye Cumhuriyeti - Istanbul Ticaret Sicili Mudurlugu, Cumhuriyet Mah. 1985. Sk. Tez Yuva Sitesi C1 Blok No: 8B Ic Kapi No: 20, Esenyurt / Istanbul",
        },
        representatives: [
          {
            role: "director",
            fullName: "Ahmet Calisci",
            fullNameI18n: {
              ru: "Ахмет Чалышджи",
              en: "Ahmet Calisci",
            },
            title: "Director",
            titleI18n: {
              ru: "Директор",
              en: "Director",
            },
            basisDocument: "Charter",
            basisDocumentI18n: {
              ru: "Устав",
              en: "Charter",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "multimodal_logistics_center",
      name: "ООО «Мультимодальный логистический центр»",
      customerExternalRef: "multimodal-logistics-center",
      counterpartyExternalRef: "multimodal-logistics-center-llc",
      shortName: "ООО «Мультимодальный логистический центр»",
      shortNameI18n: {
        ru: "ООО «Мультимодальный логистический центр»",
        en: "LLC \"Multimodal Logistics Center\"",
      },
      fullName: "ООО «Мультимодальный логистический центр»",
      fullNameI18n: {
        ru: "ООО «Мультимодальный логистический центр»",
        en: "LLC \"Multimodal Logistics Center\"",
      },
      kind: "legal_entity",
      country: "RU",
      profile: {
        legalFormCode: "ooo",
        legalFormLabel: "ООО",
        legalFormLabelI18n: {
          ru: "ООО",
          en: "LLC",
        },
        identifiers: [
          { scheme: "inn", value: "7810992797" },
          { scheme: "kpp", value: "781001001" },
          { scheme: "ogrn", value: "1147847440982" },
          { scheme: "okpo", value: "79704402" },
        ],
        address: {
          countryCode: "RU",
          city: "Saint Petersburg",
          cityI18n: {
            ru: "Санкт-Петербург",
            en: "Saint Petersburg",
          },
          fullAddress:
            "196006, Saint Petersburg, Novoroshchinskaya Street, Building 4, Letter A, Office 323-1",
          fullAddressI18n: {
            en: "196006, Saint Petersburg, Novoroshchinskaya Street, Building 4, Letter A, Office 323-1",
          },
        },
        contacts: [
          {
            type: "email",
            value: "raskovae@ml-center.com",
            isPrimary: true,
          },
        ],
        representatives: [
          {
            role: "director",
            fullName: "Stanislav Vyacheslavovich Selivanov",
            fullNameI18n: {
              ru: "Селиванов Станислав Вячеславович",
              en: "Stanislav Vyacheslavovich Selivanov",
            },
            title: "General Director",
            titleI18n: {
              ru: "Генеральный директор",
              en: "General Director",
            },
            basisDocument: "Charter",
            basisDocumentI18n: {
              ru: "Устав",
              en: "Charter",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "semen_shakshin",
      name: "Шакшин Семен Иосифович",
      customerExternalRef: "semen-shakshin",
      counterpartyExternalRef: "semen-iosifovich-shakshin",
      shortName: "Шакшин Семен Иосифович",
      shortNameI18n: {
        ru: "Шакшин Семен Иосифович",
        en: "Semen Iosifovich Shakshin",
      },
      fullName: "Шакшин Семен Иосифович",
      fullNameI18n: {
        ru: "Шакшин Семен Иосифович",
        en: "Semen Iosifovich Shakshin",
      },
      kind: "individual",
      country: "RU",
      profile: {
        identifiers: [{ scheme: "inn", value: "212100160589" }],
        address: {
          countryCode: "RU",
          city: "Saint Petersburg",
          cityI18n: {
            ru: "Санкт-Петербург",
            en: "Saint Petersburg",
          },
          fullAddress:
            "Saint Petersburg, Prospekt Marshala Blyukhera, building 49, building 3, lit. A, apt. 326",
          fullAddressI18n: {
            en: "Saint Petersburg, Prospekt Marshala Blyukhera, building 49, building 3, lit. A, apt. 326",
          },
        },
      },
    },
    {
      key: "hongkong_xintatrade",
      name: "HongKong Xintatrade International Co., Limited",
      customerExternalRef: "hongkong-xintatrade",
      counterpartyExternalRef: "hongkong-xintatrade-international",
      shortName: "HongKong Xintatrade International Co., Limited",
      shortNameI18n: {
        en: "HongKong Xintatrade International Co., Limited",
      },
      fullName: "HongKong Xintatrade International Co., Limited",
      fullNameI18n: {
        en: "HongKong Xintatrade International Co., Limited",
      },
      kind: "legal_entity",
      country: "HK",
      profile: {
        identifiers: [
          { scheme: "inn", value: "9909685189" },
          { scheme: "kpp", value: "770587001" },
        ],
        address: {
          countryCode: "HK",
          city: "Hong Kong",
          cityI18n: {
            ru: "Гонконг",
            en: "Hong Kong",
          },
          fullAddress:
            "Room 1406A, 14th Floor, Huabi Bank Building, 721-725 Nathan Road, Mong Kok, Kowloon, Hong Kong",
          fullAddressI18n: {
            en: "Room 1406A, 14th Floor, Huabi Bank Building, 721-725 Nathan Road, Mong Kok, Kowloon, Hong Kong",
          },
        },
        contacts: [
          {
            type: "email",
            value: "office@xintatrade.com",
            isPrimary: true,
          },
        ],
        representatives: [
          {
            role: "signatory",
            fullName: "Shaklein Ilya Vladimirovich",
            title: "Head of International Projects",
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "moskva_amros",
      name: "ЗАО фирма «Москва Амрос»",
      customerExternalRef: "moskva-amros",
      counterpartyExternalRef: "moskva-amros",
      shortName: "ЗАО фирма «Москва Амрос»",
      shortNameI18n: {
        ru: "ЗАО фирма «Москва Амрос»",
        en: "Closed Joint-Stock Company «Moscow-Amros Ltd.»",
      },
      fullName: "ЗАО фирма «Москва Амрос»",
      fullNameI18n: {
        ru: "ЗАО фирма «Москва Амрос»",
        en: "Closed Joint-Stock Company «Moscow-Amros Ltd.»",
      },
      kind: "legal_entity",
      country: "RU",
      profile: {
        legalFormCode: "zao",
        legalFormLabel: "ЗАО",
        legalFormLabelI18n: {
          ru: "ЗАО",
          en: "Closed Joint-Stock Company",
        },
        representatives: [
          {
            role: "director",
            fullName: "Kaplanovich Gary B",
            fullNameI18n: {
              ru: "Капланович Гари Б",
              en: "Kaplanovich Gary B",
            },
            title: "President (General director)",
            titleI18n: {
              ru: "Президент (Генеральный директор)",
              en: "President (General director)",
            },
            basisDocument: "Charter",
            basisDocumentI18n: {
              ru: "Устав",
              en: "Charter",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "vidi_technolab",
      name: "ООО «ВИДИ ТЕХНОЛАБ»",
      customerExternalRef: "vidi-technolab",
      counterpartyExternalRef: "vidi-technolab",
      shortName: "ООО «ВИДИ ТЕХНОЛАБ»",
      shortNameI18n: {
        ru: "ООО «ВИДИ ТЕХНОЛАБ»",
        en: "VD TECHNOLAB LLC",
      },
      fullName: "ООО «ВИДИ ТЕХНОЛАБ»",
      fullNameI18n: {
        ru: "Общество с ограниченной ответственностью «ВИДИ ТЕХНОЛАБ»",
        en: "VD TECHNOLAB Limited Liability Company",
      },
      kind: "legal_entity",
      country: "RU",
      profile: {
        legalFormCode: "ooo",
        legalFormLabel: "ООО",
        legalFormLabelI18n: {
          ru: "Общество с ограниченной ответственностью",
          en: "Limited Liability Company",
        },
        representatives: [
          {
            role: "director",
            fullName: "Manukyan Maria Armenovna",
            fullNameI18n: {
              ru: "Манукян Мария Арменовна",
              en: "Manukyan Maria Armenovna",
            },
            title: "Director",
            titleI18n: {
              ru: "Директор",
              en: "Director",
            },
            basisDocument: "Charter",
            basisDocumentI18n: {
              ru: "Устав",
              en: "Charter",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "rsi_capital",
      name: "RSI CAPITAL FZCO",
      customerExternalRef: "rsi-capital-fzco",
      counterpartyExternalRef: "rsi-capital-fzco",
      shortName: "RSI CAPITAL FZCO",
      shortNameI18n: {
        ru: "ЭР ЭС АЙ КЭПИТАЛ-ЭФ ЗЭТ СИ ОУ",
        en: "RSI CAPITAL FZCO",
      },
      fullName: "RSI CAPITAL FZCO",
      fullNameI18n: {
        ru: "ЭР ЭС АЙ КЭПИТАЛ-ЭФ ЗЭТ СИ ОУ",
        en: "RSI CAPITAL FZCO",
      },
      kind: "legal_entity",
      country: "AE",
      profile: {
        legalFormCode: "fzco",
        legalFormLabel: "FZCO",
        legalFormLabelI18n: {
          ru: "ФЗКО",
          en: "FZCO",
        },
        identifiers: [
          { scheme: "inn", value: "9909705558" },
          { scheme: "kpp", value: "772587001" },
        ],
        address: {
          countryCode: "AE",
          city: "Dubai",
          cityI18n: {
            ru: "Дубай",
            en: "Dubai",
          },
          fullAddress:
            "United Arab Emirates, Dubai City, Dubai International Free Zone, Dubai Silicon Oasis, IFZA Properties, DSO-IFZA",
          fullAddressI18n: {
            en: "United Arab Emirates, Dubai City, Dubai International Free Zone, Dubai Silicon Oasis, IFZA Properties, DSO-IFZA",
          },
        },
        representatives: [
          {
            role: "director",
            fullName: "Saleev Yaroslav Stanislavovich",
            fullNameI18n: {
              ru: "Салеев Ярослав Станиславович",
              en: "Saleev Yaroslav Stanislavovich",
            },
            title: "Director",
            titleI18n: {
              ru: "Директор",
              en: "Director",
            },
            basisDocument: "Licenses",
            basisDocumentI18n: {
              ru: "Лицензии",
              en: "Licenses",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "oney_finansal",
      name:
        "ONEY FINANSAL DANISMANLIK TURIZM VE DIS TICARET ANONIM SIRKETI",
      customerExternalRef: "oney-finansal",
      counterpartyExternalRef: "oney-finansal-danismanlik",
      shortName: "ONEY FINANSAL DANISMANLIK",
      shortNameI18n: {
        en: "ONEY FINANSAL DANISMANLIK",
      },
      fullName:
        "ONEY FINANSAL DANISMANLIK TURIZM VE DIS TICARET ANONIM SIRKETI",
      fullNameI18n: {
        en: "ONEY FINANSAL DANISMANLIK TURIZM VE DIS TICARET ANONIM SIRKETI",
      },
      kind: "legal_entity",
      country: "TR",
      profile: {
        identifiers: [{ scheme: "registration_number", value: "386006-5" }],
        address: {
          countryCode: "TR",
          city: "Istanbul",
          cityI18n: {
            ru: "Стамбул",
            en: "Istanbul",
          },
          fullAddress:
            "Esentepe District, Korean Martyrs Street, Ionka Apartment, No. 1-3, internal door No. 6, Sisli/Istanbul",
          fullAddressI18n: {
            en: "Esentepe District, Korean Martyrs Street, Ionka Apartment, No. 1-3, internal door No. 6, Sisli/Istanbul",
          },
        },
        representatives: [
          {
            role: "signatory",
            fullName: "Cagatay Can Oney",
            fullNameI18n: {
              ru: "Джагатай Джан Оней",
              en: "Cagatay Can Oney",
            },
            basisDocument: "Power of attorney",
            basisDocumentI18n: {
              ru: "Доверенность",
              en: "Power of attorney",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "prime_trade",
      name: "Prime Trade Corp Limited",
      customerExternalRef: "prime-trade-corp",
      counterpartyExternalRef: "prime-trade-corp-limited",
      shortName: "Prime Trade Corp Limited",
      shortNameI18n: {
        ru: "Прайм Трейд Корп Лимитед",
        en: "Prime Trade Corp Limited",
      },
      fullName: "Prime Trade Corp Limited",
      fullNameI18n: {
        ru: "Частная компания с ответственностью, ограниченной акциями «Прайм Трейд Корп Лимитед»",
        en: "Prime Trade Corp Limited",
      },
      kind: "legal_entity",
      country: "HK",
      profile: {
        identifiers: [
          { scheme: "registration_number", value: "77037559" },
          { scheme: "inn", value: "9909709104" },
        ],
        address: {
          countryCode: "HK",
          city: "Hong Kong",
          cityI18n: {
            ru: "Гонконг",
            en: "Hong Kong",
          },
          fullAddress:
            "Flat B, 11/F, Wanchai Commercial Centre, 302 Des Voeux Road Central, Sheung Wan, Hong Kong",
          fullAddressI18n: {
            en: "Flat B, 11/F, Wanchai Commercial Centre, 302 Des Voeux Road Central, Sheung Wan, Hong Kong",
          },
        },
        contacts: [
          {
            type: "email",
            value: "PrimeTradeBusiness@yandex.ru",
            isPrimary: true,
          },
        ],
        representatives: [
          {
            role: "director",
            fullName: "Grisko Aleksei",
            fullNameI18n: {
              ru: "Грисько Алексей",
              en: "Grisko Aleksei",
            },
            title: "Director",
            titleI18n: {
              ru: "Директор",
              en: "Director",
            },
            basisDocument: "Article of Association",
            basisDocumentI18n: {
              ru: "Устав",
              en: "Article of Association",
            },
            isPrimary: true,
          },
        ],
      },
    },
    {
      key: "coinex",
      name: "ОсОО «Коинекс»",
      customerExternalRef: "coinex-kg",
      counterpartyExternalRef: "coinex-kg",
      shortName: "ОсОО «Коинекс»",
      shortNameI18n: {
        ru: "ОсОО «Коинекс»",
      },
      fullName: "ОсОО «Коинекс»",
      fullNameI18n: {
        ru: "ОсОО «Коинекс»",
      },
      kind: "legal_entity",
      country: "KG",
      profile: {
        legalFormCode: "osoo",
        legalFormLabel: "ОсОО",
        legalFormLabelI18n: {
          ru: "ОсОО",
        },
        identifiers: [
          { scheme: "inn", value: "9909711022" },
          { scheme: "kpp", value: "780687001" },
          { scheme: "registration_number", value: "218194-3301-000" },
        ],
        address: {
          countryCode: "KG",
          city: "Bishkek",
          cityI18n: {
            ru: "Бишкек",
            en: "Bishkek",
          },
          fullAddress:
            "Republic of Kyrgyzstan, Bishkek, 3 Igemberdieva Street, office 206-D",
          fullAddressI18n: {
            en: "Republic of Kyrgyzstan, Bishkek, 3 Igemberdieva Street, office 206-D",
          },
        },
        contacts: [
          {
            type: "phone",
            value: "+996555551071",
            isPrimary: true,
          },
          {
            type: "email",
            value: "finance@coinex.kg",
          },
        ],
        representatives: [
          {
            role: "director",
            fullName: "Omurbaev Azizbek Kanybekovich",
            fullNameI18n: {
              ru: "Омурбаев Азизбек Каныбекович",
              en: "Omurbaev Azizbek Kanybekovich",
            },
            title: "General Director",
            titleI18n: {
              ru: "Генеральный директор",
              en: "General Director",
            },
            basisDocument: "Charter",
            basisDocumentI18n: {
              ru: "Устав",
              en: "Charter",
            },
            isPrimary: true,
          },
        ],
      },
    },
  ] as const;

export const CUSTOMER_REQUISITE_SOURCES: readonly CustomerRequisiteSource[] = [
  {
    key: "ruha_rub_gazprombank",
    counterpartyKey: "ruha_trade",
    providerKey: "gazprombank",
    currencyCode: "RUB",
    kind: "bank",
    label: "RUHA RUB (Gazprombank)",
    beneficiaryName:
      "RUHA TRADE ITHALAT IHRACAT VE DANISMANLIK LIMITED SIRKETI",
    accountNo: "40807810800000002366",
    corrAccount: "30101810200000000823",
    bic: "044525823",
    swift: "GAZPRUMM",
    isDefault: true,
    notes:
      "Imported from RUHA agency agreements with ARABIAN FUEL ALLIANCE DMCC and MULTIHANSA BROKERS - FZCO.",
  },
  {
    key: "ruha_try_gazprombank",
    counterpartyKey: "ruha_trade",
    providerKey: "gazprombank",
    currencyCode: "TRY",
    kind: "bank",
    label: "RUHA TRY (Gazprombank)",
    beneficiaryName:
      "RUHA TRADE ITHALAT IHRACAT VE DANISMANLIK LIMITED SIRKETI",
    accountNo: "40807949300000000179",
    corrAccount: "30101810200000000823",
    bic: "044525823",
    swift: "GAZPRUMM",
    isDefault: true,
    notes: "Turkish lira settlement account from the RUHA contracts.",
  },
  {
    key: "multimodal_rub_vtb",
    counterpartyKey: "multimodal_logistics_center",
    providerKey: "vtb_bank",
    currencyCode: "RUB",
    kind: "bank",
    label: "Мультимодальный логистический центр RUB (VTB)",
    beneficiaryName: "ООО «Мультимодальный логистический центр»",
    accountNo: "40702810000470917693",
    corrAccount: "30101810145250000411",
    bic: "044525411",
    isDefault: true,
    notes:
      "VTB Central Branch settlement account from the Multimodal agency agreements.",
  },
  {
    key: "shakshin_rub_sberbank",
    counterpartyKey: "semen_shakshin",
    providerKey: "sberbank_northwest",
    currencyCode: "RUB",
    kind: "bank",
    label: "Шакшин С. И. RUB (Сбербанк)",
    beneficiaryName: "Шакшин Семен Иосифович",
    accountNo: "40817810855176463118",
    corrAccount: "30101810500000000653",
    bic: "044030653",
    swift: "SABRRU2P",
    bankAddress:
      "191124, Saint Petersburg, Krasnogo Tekstilshchika Street, 2",
    isDefault: true,
    notes: "Individual customer bank account from AFA_АД 0204_Шакшин.pdf.",
  },
  {
    key: "xintatrade_rub_expobank",
    counterpartyKey: "hongkong_xintatrade",
    providerKey: "expobank",
    currencyCode: "RUB",
    kind: "bank",
    label: "Xintatrade RUB (Expobank)",
    beneficiaryName: "HongKong Xintatrade International Co., Limited",
    accountNo: "40807810401780168731",
    corrAccount: "30101810345250000460",
    bic: "044525460",
    isDefault: true,
    notes:
      "Russian settlement account captured from the import agency agreement with ARABIAN FUEL ALLIANCE DMCC.",
  },
  {
    key: "oney_rub_sberbank",
    counterpartyKey: "oney_finansal",
    providerKey: "sberbank_moscow",
    currencyCode: "RUB",
    kind: "bank",
    label: "ONEY RUB (Sberbank)",
    beneficiaryName:
      "ONEY FINANSAL DANISMANLIK TURIZM VE DIS TICARET ANONIM SIRKETI",
    accountNo: "40807810238000000567",
    corrAccount: "30101810400000000225",
    bic: "044525225",
    bankAddress: "19 Vavilova Street, Moscow, 117997, Russia",
    isDefault: true,
    notes: "RUB settlement account from AA 1212 2015Arabian Oney kopyası.pdf.",
  },
  {
    key: "prime_trade_rub_vtb",
    counterpartyKey: "prime_trade",
    providerKey: "vtb_bank",
    currencyCode: "RUB",
    kind: "bank",
    label: "Prime Trade RUB (VTB)",
    beneficiaryName: "Prime Trade Corp Limited",
    accountNo: "40807810924790000009",
    swift: "VTBRRUM2MS2",
    isDefault: true,
    notes:
      "Partial bank metadata captured from Агентский_д_р_Прайм_продажа_тез_АРАБИАН_ПОДП.pdf.",
  },
  {
    key: "rsi_capital_rub_vtb",
    counterpartyKey: "rsi_capital",
    providerKey: "vtb_bank",
    currencyCode: "RUB",
    kind: "bank",
    label: "RSI Capital RUB (VTB)",
    beneficiaryName: "RSI CAPITAL FZCO",
    accountNo: "40807810216110000009",
    corrAccount: "30101810145250000411",
    bic: "044525411",
    isDefault: true,
    notes: "Captured from договор 05.12.pdf.",
  },
  {
    key: "coinex_rub_bank_tochka",
    counterpartyKey: "coinex",
    providerKey: "bank_tochka",
    currencyCode: "RUB",
    kind: "bank",
    label: "Коинекс RUB (Точка)",
    beneficiaryName: "ОсОО «Коинекс»",
    accountNo: "40807810220000000056",
    corrAccount: "30101810745374525104",
    bic: "044525104",
    isDefault: true,
    notes:
      "Settlement account captured from the virtual asset sale contract ДКП ВА 15-26.pdf.",
  },
] as const;

export const CUSTOMER_CONTRACT_INVENTORY: readonly CustomerContractInventoryEntry[] =
  [
    {
      key: "ruha-mh-1010-2025",
      pdfFile: "1__MH_Agent-Agency -RUHA (2).pdf",
      extractionMode: "ocr",
      contractKind: "agency_agreement",
      contractNumber: "1010/2025",
      contractDate: "2025-10-10",
      customerKey: "ruha_trade",
      organizationKey: "multihansa_brokers",
      organizationRequisiteKey: "multihansa_exi_rub",
      isActive: false,
      feeRules: [{ kind: "agent_fee", unit: "bps", value: "100" }],
      capturedCounterpartyRequisites: [
        "ruha_rub_gazprombank",
        "ruha_try_gazprombank",
      ],
      notes: "Historical RUHA agreement superseded by the later Arabian contract.",
    },
    {
      key: "ruha-afa-2307-2025",
      pdfFile: "1__AF_Agent-Agency -RUHA 2026.pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "2307/2025",
      contractDate: "2026-01-12",
      customerKey: "ruha_trade",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: true,
      feeRules: [{ kind: "agent_fee", unit: "bps", value: "100" }],
      capturedCounterpartyRequisites: [
        "ruha_rub_gazprombank",
        "ruha_try_gazprombank",
      ],
      notes: "Current active RUHA agency agreement.",
    },
    {
      key: "multimodal-mh-2512-2025",
      pdfFile: "2512__MH_Agent-Agency -Мультимодальный .pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "2512/2025",
      contractDate: "2025-12-25",
      customerKey: "multimodal_logistics_center",
      organizationKey: "multihansa_brokers",
      organizationRequisiteKey: "multihansa_exi_rub",
      isActive: false,
      feeRules: [{ kind: "agent_fee", unit: "bps", value: "100" }],
      capturedCounterpartyRequisites: ["multimodal_rub_vtb"],
      notes:
        "Historical Multimodal agreement replaced by the later Arabian contract.",
    },
    {
      key: "multimodal-afa-2303-2026-1",
      pdfFile: "2303__AFA_Agent-Agency -Мультимодальный .pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "2303/2026/1",
      contractDate: "2026-03-23",
      customerKey: "multimodal_logistics_center",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: true,
      feeRules: [{ kind: "agent_fee", unit: "bps", value: "100" }],
      capturedCounterpartyRequisites: ["multimodal_rub_vtb"],
      notes: "Current active Multimodal agreement.",
    },
    {
      key: "shakshin-afa-0204-02-04",
      pdfFile: "AFA_АД 0204_Шакшин.pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "0204/02.04",
      contractDate: "2026-04-02",
      customerKey: "semen_shakshin",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: true,
      feeRules: [{ kind: "agent_fee", unit: "bps", value: "10" }],
      capturedCounterpartyRequisites: ["shakshin_rub_sberbank"],
      notes: "Individual customer agreement with reduced 0.1% fee.",
    },
    {
      key: "xintatrade-afa-ex-5-12-25-xt",
      pdfFile: "Агентский_Xinta_договор_экспорт_Арабиан_Фьюэл.pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "ex-5/12/25-XT",
      contractDate: "2025-12-03",
      customerKey: "hongkong_xintatrade",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: false,
      capturedCounterpartyRequisites: ["xintatrade_rub_expobank"],
      notes:
        "Historical export agreement. The instruction template leaves the final fee blank, so no fee rule is seeded.",
    },
    {
      key: "xintatrade-afa-im-1-03-26-xt",
      pdfFile: "АД (импорт) +.pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "im-1/03/26-XT",
      contractDate: "2026-03-05",
      customerKey: "hongkong_xintatrade",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: true,
      capturedCounterpartyRequisites: ["xintatrade_rub_expobank"],
      notes: "Current active Xintatrade import agreement.",
    },
    {
      key: "moskva-amros-mh-ma-20-04-2026",
      pdfFile: "Агентский_договор_партнер_клиент_SIGNED.pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "МА-20/04-2026",
      contractDate: "2026-04-01",
      customerKey: "moskva_amros",
      organizationKey: "multihansa_brokers",
      organizationRequisiteKey: "multihansa_exi_rub",
      isActive: true,
      notes:
        "Counterparty-side bank details are left blank in the PDF template, so only the agreement is seeded.",
    },
    {
      key: "vidi-mh-vd-0820-2026",
      pdfFile: "ВИДИ_ДОГОВОР_ПОРУЧЕНИЯ_МУЛЬТИХАНСА_БРОКЕРЗ_ФЗКО.pdf",
      extractionMode: "pdftotext",
      contractKind: "agency_agreement",
      contractNumber: "VD-0820/2026",
      contractDate: "2026-03-10",
      customerKey: "vidi_technolab",
      organizationKey: "multihansa_brokers",
      organizationRequisiteKey: "multihansa_exi_rub",
      isActive: true,
      notes:
        "The contract text is extractable, but the customer banking section is not recoverable from the source PDF.",
    },
    {
      key: "oney-afa-1212-2025",
      pdfFile: "AA 1212 2015Arabian Oney kopyası.pdf",
      extractionMode: "ocr",
      contractKind: "agency_agreement",
      contractNumber: "1212/2025",
      contractDate: "2025-12-12",
      customerKey: "oney_finansal",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: true,
      feeRules: [{ kind: "agent_fee", unit: "bps", value: "100" }],
      capturedCounterpartyRequisites: ["oney_rub_sberbank"],
      notes: "OCR-derived Oney agreement with RUB settlement account at Sberbank.",
    },
    {
      key: "prime-afa-ar-pr-1",
      pdfFile: "Агентский_д_р_Прайм_продажа_тез_АРАБИАН_ПОДП.pdf",
      extractionMode: "ocr",
      contractKind: "agency_agreement",
      contractNumber: "AR/PR-1",
      contractDate: "2025-12-15",
      customerKey: "prime_trade",
      organizationKey: "arabian_fuel_alliance",
      organizationRequisiteKey: "arabian_exi_rub",
      isActive: true,
      capturedCounterpartyRequisites: ["prime_trade_rub_vtb"],
      notes:
        "Prime Trade bank data is partial in the OCR source; seed keeps the captured RUB account and SWIFT.",
    },
    {
      key: "rsi-mh-6505",
      pdfFile: "договор 05.12.pdf",
      extractionMode: "ocr",
      contractKind: "service_agreement",
      contractNumber: "6505",
      contractDate: "2025-12-05",
      customerKey: "rsi_capital",
      organizationKey: "multihansa_brokers",
      organizationRequisiteKey: "multihansa_mts_rub",
      isActive: true,
      capturedCounterpartyRequisites: ["rsi_capital_rub_vtb"],
      notes:
        "Seeded against the explicit MTS Bank requisite captured for MULTIHANSA BROKERS - FZCO.",
    },
    {
      key: "coinex-mh-15-26",
      pdfFile: "ДКП ВА 15-26.pdf",
      extractionMode: "ocr",
      contractKind: "sale_purchase_agreement",
      contractNumber: "15/26",
      contractDate: "2026-03-04",
      customerKey: "coinex",
      organizationKey: "multihansa_brokers",
      organizationRequisiteKey: "multihansa_exi_rub",
      isActive: true,
      capturedCounterpartyRequisites: ["coinex_rub_bank_tochka"],
      notes:
        "Virtual asset sale agreement, not an agency agreement, but still seeded as a customer contract.",
    },
  ] as const;
