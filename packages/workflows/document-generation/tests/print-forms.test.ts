import { describe, expect, it, vi } from "vitest";

import { createPrintFormApplication } from "../src/print-forms";

const IDS = {
  acceptance: "acceptance-1",
  actor: "user-1",
  agreement: "agreement-1",
  application: "application-1",
  calculation: "calculation-1",
  counterparty: "counterparty-1",
  currencyRub: "currency-rub",
  currencyUsd: "currency-usd",
  customer: "customer-1",
  deal: "deal-1",
  invoice: "invoice-1",
  organization: "organization-1",
  organizationRequisite: "organization-requisite-1",
  provider: "provider-1",
  version: "agreement-version-1",
} as const;

function createPartyProfile() {
  return {
    address: {
      city: "Moscow",
      cityI18n: { en: "Moscow", ru: "Москва" },
      countryCode: "RU",
      fullAddress: "Moscow, Test street",
      fullAddressI18n: { en: "Moscow, Test street", ru: "Москва, Тестовая" },
      isPrimary: true,
      postalCode: "101000",
      streetAddress: "Test street",
    },
    contacts: [],
    identifiers: [
      {
        isPrimary: true,
        scheme: "inn",
        value: "7700000000",
      },
    ],
    profile: {
      fullName: "Client LLC",
      fullNameI18n: { en: "Client LLC", ru: "ООО Клиент" },
      legalFormLabel: "LLC",
      legalFormLabelI18n: { en: "LLC", ru: "ООО" },
      shortName: "Client",
      shortNameI18n: { en: "Client", ru: "Клиент" },
    },
    representatives: [
      {
        basisDocument: "charter",
        basisDocumentI18n: { en: "charter", ru: "устав" },
        fullName: "Ivan Ivanov",
        fullNameI18n: { en: "Ivan Ivanov", ru: "Иван Иванов" },
        isPrimary: true,
        role: "director",
        title: "CEO",
        titleI18n: { en: "CEO", ru: "Директор" },
      },
    ],
  };
}

function createCounterparty(overrides: Record<string, unknown> = {}) {
  return {
    externalRef: null,
    fullName: "Client LLC",
    id: IDS.counterparty,
    partyProfile: createPartyProfile(),
    ...overrides,
  };
}

function createOrganization(overrides: Record<string, unknown> = {}) {
  return {
    country: "RU",
    externalRef: null,
    id: IDS.organization,
    kind: "legal_entity",
    partyProfile: {
      ...createPartyProfile(),
      profile: {
        fullName: "Agent LLC",
        fullNameI18n: { en: "Agent LLC", ru: "ООО Агент" },
        shortName: "Agent",
        shortNameI18n: { en: "Agent", ru: "Агент" },
      },
    },
    sealKey: "organizations/organization-1/seal.png",
    shortName: "Agent",
    signatureKey: "organizations/organization-1/signature.png",
    ...overrides,
  };
}

function createRequisite() {
  return {
    currencyId: IDS.currencyUsd,
    id: IDS.organizationRequisite,
    identifiers: [
      {
        isPrimary: true,
        scheme: "local_account_number",
        value: "40702810900000000001",
      },
    ],
    ownerId: IDS.organization,
    providerBranchId: "branch-1",
    providerId: IDS.provider,
  };
}

function createProvider() {
  return {
    branches: [
      {
        city: "Moscow",
        cityI18n: { en: "Moscow", ru: "Москва" },
        id: "branch-1",
        identifiers: [
          {
            isPrimary: true,
            scheme: "swift",
            value: "TESTRUMM",
          },
        ],
        isPrimary: true,
        name: "Test Bank",
        nameI18n: { en: "Test Bank", ru: "Тест Банк" },
        rawAddress: "Moscow",
        rawAddressI18n: { en: "Moscow", ru: "Москва" },
      },
    ],
    displayName: "Test Bank",
    displayNameI18n: { en: "Test Bank", ru: "Тест Банк" },
    id: IDS.provider,
    identifiers: [
      {
        isPrimary: true,
        scheme: "bic",
        value: "044525000",
      },
    ],
  };
}

function createAgreement(overrides: Record<string, unknown> = {}) {
  return {
    customerId: IDS.customer,
    currentVersion: {
      contractDate: new Date("2026-04-01T00:00:00.000Z"),
      contractNumber: "AG-1",
      feeRules: [
        {
          kind: "agent_fee",
          value: "125",
        },
      ],
      id: IDS.version,
    },
    id: IDS.agreement,
    organizationId: IDS.organization,
    organizationRequisiteId: IDS.organizationRequisite,
    ...overrides,
  };
}

function createCalculation() {
  return {
    currentSnapshot: {
      additionalExpensesAmountMinor: "0",
      additionalExpensesCurrencyId: null,
      additionalExpensesInBaseMinor: "0",
      agreementFeeAmountMinor: "125",
      agreementFeeBps: "125",
      baseCurrencyId: IDS.currencyRub,
      calculationCurrencyId: IDS.currencyUsd,
      calculationTimestamp: new Date("2026-04-02T10:00:00.000Z"),
      fixedFeeAmountMinor: "1000",
      fixedFeeCurrencyId: IDS.currencyUsd,
      originalAmountMinor: "10000",
      quoteMarkupAmountMinor: "25",
      quoteMarkupBps: "25",
      rateDen: "1",
      rateNum: "91",
      rateSource: "cbr",
      totalAmountMinor: "10150",
      totalFeeAmountInBaseMinor: "13650",
      totalFeeAmountMinor: "150",
      totalFeeBps: "150",
      totalInBaseMinor: "923650",
      totalWithExpensesInBaseMinor: "923650",
    },
    id: IDS.calculation,
  };
}

function createDocument(input: {
  docNo: string;
  docType: string;
  id: string;
  payload?: Record<string, unknown>;
}) {
  return {
    amountMinor: null,
    counterpartyId: null,
    currency: null,
    docNo: input.docNo,
    docType: input.docType,
    id: input.id,
    occurredAt: new Date("2026-04-03T00:00:00.000Z"),
    organizationRequisiteId: null,
    payload: input.payload ?? {},
  };
}

function createHarness() {
  const agreement = createAgreement();
  const application = createDocument({
    docNo: "APP-1",
    docType: "application",
    id: IDS.application,
    payload: {
      calculationId: IDS.calculation,
      counterpartyId: IDS.counterparty,
      organizationId: IDS.organization,
      organizationRequisiteId: IDS.organizationRequisite,
    },
  });
  const invoice = createDocument({
    docNo: "INV-1",
    docType: "invoice",
    id: IDS.invoice,
    payload: {
      amount: "100.00",
      currency: "USD",
    },
  });
  const acceptance = createDocument({
    docNo: "ACT-1",
    docType: "acceptance",
    id: IDS.acceptance,
    payload: {
      applicationDocumentId: IDS.application,
      invoiceDocumentId: IDS.invoice,
      memo: "paid",
    },
  });
  const documents = new Map([
    [`acceptance:${IDS.acceptance}`, { dealId: IDS.deal, document: acceptance }],
    [`application:${IDS.application}`, { dealId: IDS.deal, document: application }],
    [`invoice:${IDS.invoice}`, { dealId: IDS.deal, document: invoice }],
  ]);
  const generateDealDocument = vi.fn(async (request) => ({
    buffer: Buffer.from("deal-document"),
    fileName: `${request.templateType}.docx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }));
  const generateCalculation = vi.fn(async () => ({
    buffer: Buffer.from("calculation"),
    fileName: "calculation.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }));
  const renderClientContract = vi.fn(async () => ({
    buffer: Buffer.from("contract"),
    fileName: "contract.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }));
  const deps = {
    agreementsModule: {
      agreements: {
        queries: {
          findById: vi.fn(async () => agreement),
        },
      },
    },
    calculationsModule: {
      calculations: {
        queries: {
          findById: vi.fn(async () => createCalculation()),
        },
      },
    },
    currenciesService: {
      findById: vi.fn(async (currencyId: string) => ({
        code: currencyId === IDS.currencyRub ? "RUB" : "USD",
        id: currencyId,
        precision: 2,
      })),
    },
    dealsModule: {
      deals: {
        queries: {
          findById: vi.fn(async () => ({
            agreementId: IDS.agreement,
            amount: "100.00",
            calculationId: IDS.calculation,
            currencyId: IDS.currencyUsd,
            id: IDS.deal,
            participants: [],
          })),
          findWorkflowById: vi.fn(async () => ({
            intake: {
              common: {
                applicantCounterpartyId: IDS.counterparty,
              },
            },
            participants: [
              {
                counterpartyId: IDS.counterparty,
                role: "applicant",
              },
              {
                organizationId: IDS.organization,
                role: "internal_entity",
              },
            ],
          })),
        },
      },
    },
    documentGenerationWorkflow: {
      generateCalculation,
      generateDealDocument,
      renderClientContract,
    },
    documentsService: {
      get: vi.fn(async (docType: string, id: string) => {
        const result = documents.get(`${docType}:${id}`);
        if (!result) {
          throw new Error(`missing document ${docType}:${id}`);
        }

        return result;
      }),
    },
    partiesModule: {
      counterparties: {
        queries: {
          findById: vi.fn(async () => createCounterparty()),
          list: vi.fn(async () => ({
            data: [{ id: IDS.counterparty }],
            limit: 1,
            offset: 0,
            total: 1,
          })),
        },
      },
      organizations: {
        queries: {
          findById: vi.fn(async () => createOrganization()),
        },
      },
      requisites: {
        queries: {
          findById: vi.fn(async () => createRequisite()),
          findOrganizationBankById: vi.fn(async () => createRequisite()),
          findPreferredCounterpartyBankByCounterpartyId: vi.fn(async () => ({
            ...createRequisite(),
            ownerId: IDS.counterparty,
          })),
          findProviderById: vi.fn(async () => createProvider()),
        },
      },
    },
  } as any;

  return {
    app: createPrintFormApplication(deps),
    deps,
  };
}

describe("print form application", () => {
  it("lists document print forms by owner type and document type", async () => {
    const { app } = createHarness();

    const forms = await app.listDocumentPrintForms({
      actorUserId: IDS.actor,
      docType: "application",
      documentId: IDS.application,
    });

    expect(forms.map((form) => form.id)).toEqual(["document.application-ru"]);
    expect(forms[0]).toMatchObject({
      ownerType: "document",
      quality: "ready",
      title: "Поручение",
    });
  });

  it("resolves acceptance parent application and dependent invoice for print context", async () => {
    const { app, deps } = createHarness();

    await app.generateDocumentPrintForm({
      actorUserId: IDS.actor,
      docType: "acceptance",
      documentId: IDS.acceptance,
      formId: "document.acceptance-bilingual",
      format: "pdf",
    });

    expect(deps.documentsService.get).toHaveBeenCalledWith(
      "application",
      IDS.application,
      IDS.actor,
    );
    expect(deps.documentsService.get).toHaveBeenCalledWith(
      "invoice",
      IDS.invoice,
      IDS.actor,
    );
    expect(deps.documentGenerationWorkflow.generateDealDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        deal: expect.objectContaining({
          acceptanceNumber: "ACT-1",
          applicationNumber: "APP-1",
          invoiceNumber: "INV-1",
          memo: "paid",
        }),
        format: "pdf",
        templateType: "acceptance",
      }),
    );
  });

  it("serializes calculation print form data before generation", async () => {
    const { app, deps } = createHarness();

    await app.generateCalculationPrintForm({
      calculationId: IDS.calculation,
      formId: "calculation.calculation-ru",
      format: "docx",
    });

    expect(deps.documentGenerationWorkflow.generateCalculation).toHaveBeenCalledWith({
      calculationData: expect.objectContaining({
        agreementFeePercentage: "1.25",
        currencyCode: "USD",
        finalRate: "91",
        fixedFeeAmount: "10.00",
        originalAmount: "100.00",
        quoteMarkupPercentage: "0.25",
        rateSource: "cbru",
      }),
      format: "docx",
      lang: "ru",
    });
  });

  it("keeps bilingual warning quality for agreement contract print forms", async () => {
    const { app, deps } = createHarness();
    deps.partiesModule.organizations.queries.findById.mockResolvedValueOnce(
      createOrganization({
        partyProfile: {
          ...createPartyProfile(),
          representatives: [
            {
              fullName: "Director",
              isPrimary: true,
              role: "director",
            },
          ],
        },
      }),
    );

    const forms = await app.listAgreementVersionPrintForms({
      agreementId: IDS.agreement,
      versionId: IDS.version,
    });

    expect(forms).toHaveLength(1);
    expect(forms[0]).toMatchObject({
      id: "agreement_version.customer-contract-bilingual",
      languageMode: "bilingual",
      quality: "draft",
    });
    expect(forms[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_translation",
          field: "organization.directorName",
        }),
      ]),
    );
  });
});
