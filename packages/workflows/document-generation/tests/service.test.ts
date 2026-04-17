import { describe, expect, it, vi } from "vitest";

import {
  createDocumentGenerationWorkflow,
  CustomerContractNotFoundError,
  CustomerContractOrganizationNotFoundError,
  OrganizationFileMissingInStorageError,
  OrganizationFilesNotConfiguredError,
} from "../src";

const IDS = {
  agreement: "00000000-0000-4000-8000-000000000301",
  agreementVersion: "00000000-0000-4000-8000-000000000302",
  counterparty: "00000000-0000-4000-8000-000000000303",
  counterpartyBankRequisite: "00000000-0000-4000-8000-000000000304",
  currencyUsd: "00000000-0000-4000-8000-000000000305",
  customer: "00000000-0000-4000-8000-000000000306",
  organization: "00000000-0000-4000-8000-000000000307",
  organizationRequisite: "00000000-0000-4000-8000-000000000308",
  providerCounterparty: "00000000-0000-4000-8000-000000000309",
  providerOrganization: "00000000-0000-4000-8000-000000000310",
} as const;

function createAgreementDetails() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    id: IDS.agreement,
    customerId: IDS.customer,
    organizationId: IDS.organization,
    organizationRequisiteId: IDS.organizationRequisite,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentVersion: {
      id: IDS.agreementVersion,
      versionNumber: 1,
      contractNumber: "AG-2026-001",
      contractDate: new Date("2026-04-01T00:00:00.000Z"),
      feeRules: [
        {
          id: "fee-rule-agent",
          kind: "agent_fee",
          unit: "bps",
          value: "125",
          currencyId: null,
          currencyCode: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "fee-rule-fixed",
          kind: "fixed_fee",
          unit: "money",
          value: "100",
          currencyId: IDS.currencyUsd,
          currencyCode: "USD",
          createdAt: now,
          updatedAt: now,
        },
      ],
      parties: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createWorkflow(overrides?: {
  agreement?: Record<string, unknown> | null;
  counterparty?: Record<string, unknown> | null;
  counterpartyBankRequisite?: Record<string, unknown> | null;
  downloadImpl?: ((key: string) => Buffer | Promise<Buffer>) | null;
  downloadError?: Error | null;
  organization?: Record<string, unknown> | null;
  organizationProvider?: Record<string, unknown> | null;
  organizationRequisite?: Record<string, unknown> | null;
}) {
  const agreement =
    overrides?.agreement === undefined
      ? createAgreementDetails()
      : overrides.agreement;
  const counterparty =
    overrides?.counterparty === undefined
      ? {
          id: IDS.counterparty,
          customerId: IDS.customer,
          relationshipKind: "customer_owned",
          shortName: "Client LLC",
          fullName: "Client LLC",
          externalRef: null,
          description: null,
          country: "RU",
          kind: "legal_entity",
          groupIds: [],
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          partyProfile: {
            profile: {
              id: `${IDS.counterparty}-profile`,
              organizationId: null,
              counterpartyId: IDS.counterparty,
              fullName: "Client LLC",
              shortName: "Client LLC",
              fullNameI18n: { ru: "Клиент ООО", en: "Client LLC" },
              shortNameI18n: { ru: "Клиент ООО", en: "Client LLC" },
              legalFormCode: null,
              legalFormLabel: "LLC",
              legalFormLabelI18n: { ru: "ООО", en: "LLC" },
              countryCode: "RU",
              businessActivityCode: null,
              businessActivityText: null,
              businessActivityTextI18n: null,
              createdAt: new Date("2026-04-01T00:00:00.000Z"),
              updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            },
            identifiers: [
              {
                id: `${IDS.counterparty}-inn`,
                partyLegalProfileId: `${IDS.counterparty}-profile`,
                scheme: "inn",
                value: "7700000000",
                normalizedValue: "7700000000",
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
              {
                id: `${IDS.counterparty}-kpp`,
                partyLegalProfileId: `${IDS.counterparty}-profile`,
                scheme: "kpp",
                value: "770001001",
                normalizedValue: "770001001",
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
            ],
            address: {
              id: `${IDS.counterparty}-address`,
              partyLegalProfileId: `${IDS.counterparty}-profile`,
              countryCode: "RU",
              postalCode: null,
              city: null,
              cityI18n: null,
              streetAddress: null,
              streetAddressI18n: null,
              addressDetails: null,
              addressDetailsI18n: null,
              fullAddress: "Moscow",
              fullAddressI18n: { ru: "Москва", en: "Moscow" },
              createdAt: new Date("2026-04-01T00:00:00.000Z"),
              updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            },
            contacts: [],
            representatives: [
              {
                id: `${IDS.counterparty}-director`,
                partyLegalProfileId: `${IDS.counterparty}-profile`,
                role: "director",
                fullName: "Иван Иванов",
                fullNameI18n: {
                  ru: "Иван Иванов",
                  en: "Ivan Ivanov",
                },
                title: null,
                titleI18n: null,
                basisDocument: "Устава",
                basisDocumentI18n: {
                  ru: "Устава",
                  en: "Articles of Association",
                },
                isPrimary: true,
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
            ],
            licenses: [],
          },
        }
      : overrides.counterparty;
  const organization =
    overrides?.organization === undefined
      ? {
          id: IDS.organization,
          externalRef: null,
          shortName: "Multihansa",
          fullName: "Multihansa Financial Services Ltd",
          description: null,
          country: "RU",
          kind: "legal_entity",
          isActive: true,
          signatureKey: `organizations/${IDS.organization}/signature.png`,
          sealKey: `organizations/${IDS.organization}/seal.png`,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          partyProfile: {
            profile: {
              id: `${IDS.organization}-profile`,
              organizationId: IDS.organization,
              counterpartyId: null,
              fullName: "Multihansa Financial Services Ltd",
              shortName: "Multihansa",
              fullNameI18n: {
                ru: "Мультиханса Файненшел Сервисез",
                en: "Multihansa Financial Services Ltd",
              },
              shortNameI18n: { ru: "Мультиханса", en: "Multihansa" },
              legalFormCode: null,
              legalFormLabel: null,
              legalFormLabelI18n: null,
              countryCode: "RU",
              businessActivityCode: null,
              businessActivityText: null,
              businessActivityTextI18n: null,
              createdAt: new Date("2026-04-01T00:00:00.000Z"),
              updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            },
            identifiers: [
              {
                id: `${IDS.organization}-inn`,
                partyLegalProfileId: `${IDS.organization}-profile`,
                scheme: "inn",
                value: "1234567890",
                normalizedValue: "1234567890",
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
              {
                id: `${IDS.organization}-tax`,
                partyLegalProfileId: `${IDS.organization}-profile`,
                scheme: "tax_id",
                value: "1234567890",
                normalizedValue: "1234567890",
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
              {
                id: `${IDS.organization}-kpp`,
                partyLegalProfileId: `${IDS.organization}-profile`,
                scheme: "kpp",
                value: "123456789",
                normalizedValue: "123456789",
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
            ],
            address: {
              id: `${IDS.organization}-address`,
              partyLegalProfileId: `${IDS.organization}-profile`,
              countryCode: "RU",
              postalCode: null,
              city: null,
              cityI18n: null,
              streetAddress: null,
              streetAddressI18n: null,
              addressDetails: null,
              addressDetailsI18n: null,
              fullAddress: "Tverskaya 1",
              fullAddressI18n: { ru: "Тверская 1", en: "Tverskaya 1" },
              createdAt: new Date("2026-04-01T00:00:00.000Z"),
              updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            },
            contacts: [],
            representatives: [
              {
                id: `${IDS.organization}-director`,
                partyLegalProfileId: `${IDS.organization}-profile`,
                role: "director",
                fullName: "Петр Петров",
                fullNameI18n: {
                  ru: "Петр Петров",
                  en: "Peter Petrov",
                },
                title: null,
                titleI18n: null,
                basisDocument: null,
                basisDocumentI18n: null,
                isPrimary: true,
                createdAt: new Date("2026-04-01T00:00:00.000Z"),
                updatedAt: new Date("2026-04-01T00:00:00.000Z"),
              },
            ],
            licenses: [],
          },
        }
      : overrides.organization;
  const organizationRequisite =
    overrides?.organizationRequisite === undefined
      ? {
    id: IDS.organizationRequisite,
    ownerType: "organization",
    ownerId: IDS.organization,
    organizationId: IDS.organization,
    counterpartyId: null,
    providerId: IDS.providerOrganization,
    providerBranchId: null,
    currencyId: IDS.currencyUsd,
    kind: "bank",
    label: "Main org bank",
    beneficiaryName: null,
    beneficiaryNameLocal: null,
    beneficiaryAddress: null,
    paymentPurposeTemplate: null,
    notes: null,
    identifiers: [
      {
        id: `${IDS.organizationRequisite}-account`,
        requisiteId: IDS.organizationRequisite,
        scheme: "local_account_number",
        value: "40702810900000000001",
        normalizedValue: "40702810900000000001",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ],
    isDefault: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    archivedAt: null,
      }
      : overrides.organizationRequisite;
  const counterpartyBankRequisite =
    overrides?.counterpartyBankRequisite === undefined
      ? {
    id: IDS.counterpartyBankRequisite,
    ownerType: "counterparty",
    ownerId: IDS.counterparty,
    organizationId: null,
    counterpartyId: IDS.counterparty,
    providerId: IDS.providerCounterparty,
    providerBranchId: null,
    currencyId: IDS.currencyUsd,
    kind: "bank",
    label: "Client bank",
    beneficiaryName: null,
    beneficiaryNameLocal: null,
    beneficiaryAddress: null,
    paymentPurposeTemplate: null,
    notes: null,
    identifiers: [
      {
        id: `${IDS.counterpartyBankRequisite}-account`,
        requisiteId: IDS.counterpartyBankRequisite,
        scheme: "local_account_number",
        value: "40702810900000000002",
        normalizedValue: "40702810900000000002",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ],
    isDefault: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    archivedAt: null,
      }
      : overrides.counterpartyBankRequisite;
  const organizationProvider =
    overrides?.organizationProvider === undefined
      ? {
    id: IDS.providerOrganization,
    kind: "bank",
    legalName: "Org Bank",
    legalNameI18n: { en: "Org Bank", ru: "Банк агента" },
    displayName: "Org Bank",
    displayNameI18n: { en: "Org Bank", ru: "Банк агента" },
    description: null,
    country: "RU",
    website: null,
    identifiers: [
      {
        id: `${IDS.providerOrganization}-bic`,
        scheme: "bic",
        value: "044525225",
        normalizedValue: "044525225",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        id: `${IDS.providerOrganization}-swift`,
        scheme: "swift",
        value: "ORGSRUMM",
        normalizedValue: "ORGSRUMM",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        id: `${IDS.providerOrganization}-corr`,
        scheme: "corr_account",
        value: "30101810400000000225",
        normalizedValue: "30101810400000000225",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ],
    branches: [
      {
        id: `${IDS.providerOrganization}-branch`,
        providerId: IDS.providerOrganization,
        code: null,
        name: "Org Bank",
        nameI18n: { en: "Org Bank", ru: "Банк агента" },
        country: "RU",
        postalCode: null,
        city: null,
        cityI18n: null,
        line1: null,
        line1I18n: null,
        line2: null,
        line2I18n: null,
        rawAddress: "Moscow",
        rawAddressI18n: { en: "Moscow", ru: "Москва" },
        contactEmail: null,
        contactPhone: null,
        isPrimary: true,
        archivedAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        identifiers: [],
      },
    ],
    archivedAt: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      }
      : overrides.organizationProvider;
  const counterpartyProvider = {
    id: IDS.providerCounterparty,
    kind: "bank",
    legalName: "Client Bank",
    legalNameI18n: { en: "Client Bank", ru: "Банк клиента" },
    displayName: "Client Bank",
    displayNameI18n: { en: "Client Bank", ru: "Банк клиента" },
    description: null,
    country: "RU",
    website: null,
    identifiers: [
      {
        id: `${IDS.providerCounterparty}-bic`,
        scheme: "bic",
        value: "044030653",
        normalizedValue: "044030653",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        id: `${IDS.providerCounterparty}-swift`,
        scheme: "swift",
        value: "CLNTRUMM",
        normalizedValue: "CLNTRUMM",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        id: `${IDS.providerCounterparty}-corr`,
        scheme: "corr_account",
        value: "30101810400000000226",
        normalizedValue: "30101810400000000226",
        isPrimary: true,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ],
    branches: [
      {
        id: `${IDS.providerCounterparty}-branch`,
        providerId: IDS.providerCounterparty,
        code: null,
        name: "Client Bank",
        nameI18n: { en: "Client Bank", ru: "Банк клиента" },
        country: "RU",
        postalCode: null,
        city: null,
        cityI18n: null,
        line1: null,
        line1I18n: null,
        line2: null,
        line2I18n: null,
        rawAddress: "Saint Petersburg",
        rawAddressI18n: { en: "Saint Petersburg", ru: "Санкт-Петербург" },
        contactEmail: null,
        contactPhone: null,
        isPrimary: true,
        archivedAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        identifiers: [],
      },
    ],
    archivedAt: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  };

  const templateRenderer = {
    renderDocx: vi.fn(async () => Buffer.from("docx")),
  };
  const pdfConverter = {
    convertDocxToPdf: vi.fn(async () => Buffer.from("pdf")),
  };
  const objectStorage = {
    upload: vi.fn(),
    download: vi.fn(async (key: string) => {
      if (overrides?.downloadImpl) {
        return overrides.downloadImpl(key);
      }

      if (overrides?.downloadError) {
        throw overrides.downloadError;
      }

      return Buffer.from("image");
    }),
    delete: vi.fn(),
  };
  const workflow = createDocumentGenerationWorkflow({
    agreements: {
      agreements: {
        queries: {
          findActiveByCustomerId: vi.fn(async () => agreement),
        },
      },
    } as any,
    currencies: {
      findById: vi.fn(async () => ({
        id: IDS.currencyUsd,
        name: "US Dollar",
        code: "USD",
        symbol: "$",
        precision: 2,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      })),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as any,
    objectStorage,
    parties: {
      counterparties: {
        queries: {
          findById: vi.fn(async () => counterparty),
        },
      },
      organizations: {
        queries: {
          findById: vi.fn(async () => organization),
        },
      },
      requisites: {
        queries: {
          findOrganizationBankById: vi.fn(async () => organizationRequisite),
          findPreferredCounterpartyBankByCounterpartyId: vi.fn(
            async () => counterpartyBankRequisite,
          ),
          findProviderById: vi.fn(async (providerId: string) => {
            if (providerId === IDS.providerOrganization) {
              return organizationProvider;
            }

            return counterpartyProvider;
          }),
        },
      },
    } as any,
    pdfConverter,
    templateRenderer,
  });

  return {
    fixtures: {
      agreement,
      counterparty,
      counterpartyBankRequisite,
      counterpartyProvider,
      organization,
      organizationProvider,
      organizationRequisite,
    },
    objectStorage,
    pdfConverter,
    templateRenderer,
    workflow,
  };
}

describe("document generation workflow", () => {
  it("generates a customer contract from ids only", async () => {
    const { objectStorage, templateRenderer, workflow } = createWorkflow();

    const result = await workflow.generateCustomerContract({
      customerId: IDS.customer,
      counterpartyId: IDS.counterparty,
    });

    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result.fileName).toMatch(/^contract-[0-9A-F]{8}-[0-9A-F]{8}\.docx$/);
    expect(objectStorage.download).toHaveBeenCalledWith(
      `organizations/${IDS.organization}/signature.png`,
    );
    expect(objectStorage.download).toHaveBeenCalledWith(
      `organizations/${IDS.organization}/seal.png`,
    );
    expect(templateRenderer.renderDocx).toHaveBeenCalledWith(
      "contract",
      expect.objectContaining({
        contractNumber: "AG-2026-001",
        agentBankCurrencyCode: "USD",
        agentBankName: "Банк агента",
        agentBankName_en: "Org Bank",
        agentFee: "1.25",
        fixedFee: "100",
      }),
      "ru",
      IDS.organization,
    );
  });

  it("renders a client contract from typed nested DTOs", async () => {
    const {
      fixtures,
      templateRenderer,
      workflow,
    } = createWorkflow();

    await workflow.renderClientContract({
      agreement: {
        id: IDS.agreement,
        contractNumber: "AG-typed",
        contractDate: "2026-04-01",
        agentFee: "1.50",
        fixedFee: "25",
      },
      clientBankProvider: fixtures.counterpartyProvider as any,
      clientBankRequisite: fixtures.counterpartyBankRequisite as any,
      clientCounterparty: fixtures.counterparty as any,
      organization: fixtures.organization as any,
      organizationRequisite: fixtures.organizationRequisite as any,
      organizationRequisiteProvider: fixtures.organizationProvider as any,
    });

    expect(templateRenderer.renderDocx).toHaveBeenCalledWith(
      "contract",
      expect.objectContaining({
        bankAddress: "Санкт-Петербург",
        bankName: "Банк клиента",
        contractNumber: "AG-typed",
        agentBankName: "Банк агента",
        agentBankName_en: "Org Bank",
        date: "2026-04-01",
      }),
      "ru",
      IDS.organization,
    );
  });

  it("preserves 404-compatible behavior when no active contract exists", async () => {
    const { workflow } = createWorkflow({
      agreement: null,
    });

    await expect(
      workflow.generateCustomerContract({
        customerId: IDS.customer,
        counterpartyId: IDS.counterparty,
      }),
    ).rejects.toBeInstanceOf(CustomerContractNotFoundError);
  });

  it("rejects counterparty ids that do not belong to the customer-owned scope", async () => {
    const { workflow } = createWorkflow({
      counterparty: {
        id: IDS.counterparty,
        customerId: "00000000-0000-4000-8000-000000000399",
        relationshipKind: "external",
      },
    });

    await expect(
      workflow.generateCustomerContract({
        customerId: IDS.customer,
        counterpartyId: IDS.counterparty,
      }),
    ).rejects.toThrow(`Customer counterparty not found: ${IDS.counterparty}`);
  });

  it("rejects missing organizations or mismatched organization requisites", async () => {
    const { workflow } = createWorkflow({
      organizationRequisite: {
        id: IDS.organizationRequisite,
        ownerId: "00000000-0000-4000-8000-000000000398",
      },
    });

    await expect(
      workflow.generateCustomerContract({
        customerId: IDS.customer,
        counterpartyId: IDS.counterparty,
      }),
    ).rejects.toBeInstanceOf(CustomerContractOrganizationNotFoundError);
  });

  it("fails with a validation-style error when signature or seal metadata is missing", async () => {
    const { fixtures, workflow } = createWorkflow();

    await expect(
      workflow.renderClientContract({
        agreement: {
          id: IDS.agreement,
          contractNumber: "AG-typed",
          contractDate: "2026-04-01",
          agentFee: null,
          fixedFee: null,
        },
        clientBankProvider: null,
        clientBankRequisite: null,
        clientCounterparty: fixtures.counterparty as any,
        format: "pdf",
        organization: {
          ...fixtures.organization,
          signatureKey: null,
          sealKey: null,
        } as any,
        organizationRequisite: fixtures.organizationRequisite as any,
        organizationRequisiteProvider: fixtures.organizationProvider as any,
      }),
    ).rejects.toBeInstanceOf(OrganizationFilesNotConfiguredError);
  });

  it("fails with a validation-style error when signature or seal objects are missing in storage", async () => {
    const { workflow } = createWorkflow({
      downloadError: new Error(
        "Failed to download file from S3: The specified key does not exist.",
      ),
    });

    await expect(
      workflow.generateCustomerContract({
        customerId: IDS.customer,
        counterpartyId: IDS.counterparty,
        format: "pdf",
      }),
    ).rejects.toBeInstanceOf(OrganizationFileMissingInStorageError);
  });

  it("renders DOCX without sign or seal when organization signing metadata is missing", async () => {
    const { fixtures, objectStorage, templateRenderer, workflow } = createWorkflow();

    const result = await workflow.renderClientContract({
      agreement: {
        id: IDS.agreement,
        contractNumber: "AG-typed",
        contractDate: "2026-04-01",
        agentFee: null,
        fixedFee: null,
      },
      clientBankProvider: null,
      clientBankRequisite: null,
      clientCounterparty: fixtures.counterparty as any,
      format: "docx",
      organization: {
        ...fixtures.organization,
        signatureKey: null,
        sealKey: null,
      } as any,
      organizationRequisite: fixtures.organizationRequisite as any,
      organizationRequisiteProvider: fixtures.organizationProvider as any,
    });

    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(objectStorage.download).not.toHaveBeenCalled();
    expect(templateRenderer.renderDocx).toHaveBeenCalledWith(
      "contract",
      expect.objectContaining({
        showSignature: false,
        showStamp: false,
      }),
      "ru",
      IDS.organization,
    );

    const payload = (templateRenderer.renderDocx.mock.calls as unknown[][])[0]?.[
      1
    ] as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    if (!payload) {
      throw new Error("Expected renderDocx payload");
    }
    expect(payload).not.toHaveProperty("signature");
    expect(payload).not.toHaveProperty("stamp");
  });

  it("renders DOCX with the available signing asset only", async () => {
    const { objectStorage, templateRenderer, workflow } = createWorkflow({
      downloadImpl: async (key: string) => {
        if (key.endsWith("/seal.png")) {
          throw new Error("seal not found");
        }

        return Buffer.from("image");
      },
    });

    await workflow.generateCustomerContract({
      customerId: IDS.customer,
      counterpartyId: IDS.counterparty,
      format: "docx",
    });

    expect(objectStorage.download).toHaveBeenCalledTimes(2);
    expect(templateRenderer.renderDocx).toHaveBeenCalledWith(
      "contract",
      expect.objectContaining({
        showSignature: true,
        showStamp: false,
      }),
      "ru",
      IDS.organization,
    );

    const payload = (templateRenderer.renderDocx.mock.calls as unknown[][])[0]?.[
      1
    ] as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    if (!payload) {
      throw new Error("Expected renderDocx payload");
    }
    expect(payload).toHaveProperty("signature");
    expect(payload).not.toHaveProperty("stamp");
  });

  it("falls back to an 8-character uuid prefix when the contract number is missing", async () => {
    const { templateRenderer, workflow } = createWorkflow({
      agreement: {
        ...createAgreementDetails(),
        currentVersion: {
          ...createAgreementDetails().currentVersion,
          contractNumber: null,
        },
      },
    });

    await workflow.generateCustomerContract({
      customerId: IDS.customer,
      counterpartyId: IDS.counterparty,
    });

    expect(templateRenderer.renderDocx).toHaveBeenCalledWith(
      "contract",
      expect.objectContaining({
        contractNumber: IDS.agreement.slice(0, 8),
        number: IDS.agreement.slice(0, 8),
      }),
      "ru",
      IDS.organization,
    );
  });

  it("generate() embeds the template type and a random suffix in the filename", async () => {
    const { workflow } = createWorkflow();

    const result = await workflow.generate({
      templateType: "invoice",
      data: {},
      locale: "ru",
      outputFormat: "docx",
    });

    expect(result.fileName).toMatch(/^invoice-[0-9A-F]{8}\.docx$/);
  });

  it("generateCalculation() embeds the calculation id and a random suffix in the filename", async () => {
    const { workflow } = createWorkflow();
    const calculationId = "11111111-2222-4333-8444-555555555555";

    const result = await workflow.generateCalculation({
      calculationData: {
        additionalExpenses: "0",
        additionalExpensesInBase: "0",
        agreementFeeAmount: "0",
        agreementFeePercentage: "0",
        baseCurrencyCode: "USD",
        calculationTimestamp: "2026-04-01T00:00:00.000Z",
        currencyCode: "USD",
        fixedFeeAmount: "0",
        fixedFeeCurrencyCode: null,
        finalRate: "1",
        id: calculationId,
        originalAmount: "100",
        quoteMarkupAmount: "0",
        quoteMarkupPercentage: "0",
        rate: "1",
        rateSource: "manual",
        totalFeeAmount: "0",
        totalFeeAmountInBase: "0",
        totalFeePercentage: "0",
        totalAmount: "100",
        totalInBase: "100",
        totalWithExpensesInBase: "100",
      },
      format: "docx",
    });

    expect(result.fileName).toMatch(/^calculation-11111111-[0-9A-F]{8}\.docx$/);
  });

  it("generateDealDocument() embeds the deal id and a random suffix in the filename", async () => {
    const { workflow } = createWorkflow();
    const dealId = "22222222-3333-4444-8555-666666666666";

    const result = await workflow.generateDealDocument({
      templateType: "application",
      deal: { id: dealId },
      calculation: {},
      client: {},
      contract: {},
      organization: { id: IDS.organization },
      organizationRequisite: {},
    });

    expect(result.fileName).toMatch(/^application-22222222-[0-9A-F]{8}\.docx$/);
  });

  it("generateDealDocument() falls back to a kind-only filename when deal id is missing", async () => {
    const { workflow } = createWorkflow();

    const result = await workflow.generateDealDocument({
      templateType: "invoice",
      deal: {},
      calculation: {},
      client: {},
      contract: {},
      organization: { id: IDS.organization },
      organizationRequisite: {},
    });

    expect(result.fileName).toMatch(/^invoice-[0-9A-F]{8}\.docx$/);
  });

  it("generateFromRawData() uses the template name and a random suffix", async () => {
    const { workflow } = createWorkflow();

    const result = await workflow.generateFromRawData({
      templateName: "custom-template.docx",
      data: {},
      format: "docx",
    });

    expect(result.fileName).toMatch(/^custom-template-[0-9A-F]{8}\.docx$/);
  });
});
