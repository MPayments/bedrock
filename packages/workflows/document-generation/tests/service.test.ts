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
    orgNameI18n: { ru: "Клиент ООО", en: "Client LLC" },
    orgType: "LLC",
    orgTypeI18n: { ru: "ООО", en: "LLC" },
    directorName: "Иван Иванов",
    directorNameI18n: {
      ru: "Иван Иванов",
      en: "Ivan Ivanov",
    },
    position: null,
    positionI18n: null,
    directorBasis: "Устава",
    directorBasisI18n: {
      ru: "Устава",
      en: "Articles of Association",
    },
    address: "Moscow",
    addressI18n: { ru: "Москва", en: "Moscow" },
    email: null,
    phone: null,
    inn: "7700000000",
    kpp: "770001001",
    ogrn: null,
    oktmo: null,
    okpo: null,
    description: null,
    country: "RU",
    kind: "legal_entity",
    groupIds: [],
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      }
      : overrides.counterparty;
  const organization =
    overrides?.organization === undefined
      ? {
    id: IDS.organization,
    externalId: null,
    shortName: "Multihansa",
    fullName: "Multihansa Financial Services Ltd",
    description: null,
    country: "RU",
    kind: "legal_entity",
    isActive: true,
    nameI18n: { ru: "Мультиханса", en: "Multihansa" },
    orgType: null,
    orgTypeI18n: null,
    countryI18n: { ru: "Россия", en: "Russia" },
    city: "Moscow",
    cityI18n: { ru: "Москва", en: "Moscow" },
    address: "Tverskaya 1",
    addressI18n: { ru: "Тверская 1", en: "1 Tverskaya" },
    inn: "1234567890",
    taxId: "1234567890",
    kpp: "123456789",
    ogrn: null,
    oktmo: null,
    okpo: null,
    directorName: "Петр Петров",
    directorNameI18n: {
      ru: "Петр Петров",
      en: "Peter Petrov",
    },
    directorPosition: null,
    directorPositionI18n: null,
    directorBasis: null,
    directorBasisI18n: null,
    signatureKey: `organizations/${IDS.organization}/signature.png`,
    sealKey: `organizations/${IDS.organization}/seal.png`,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
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
      {
        id: `${IDS.organizationRequisite}-corr`,
        requisiteId: IDS.organizationRequisite,
        scheme: "corr_account",
        value: "30101810400000000225",
        normalizedValue: "30101810400000000225",
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
      {
        id: `${IDS.counterpartyBankRequisite}-corr`,
        requisiteId: IDS.counterpartyBankRequisite,
        scheme: "corr_account",
        value: "30101810400000000226",
        normalizedValue: "30101810400000000226",
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
    displayName: "Org Bank",
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
    ],
    branches: [
      {
        id: `${IDS.providerOrganization}-branch`,
        providerId: IDS.providerOrganization,
        code: null,
        name: "Org Bank",
        country: "RU",
        postalCode: null,
        city: null,
        line1: null,
        line2: null,
        rawAddress: "Moscow",
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
    displayName: "Client Bank",
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
    ],
    branches: [
      {
        id: `${IDS.providerCounterparty}-branch`,
        providerId: IDS.providerCounterparty,
        code: null,
        name: "Client Bank",
        country: "RU",
        postalCode: null,
        city: null,
        line1: null,
        line2: null,
        rawAddress: "Saint Petersburg",
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
    download: vi.fn(async () => {
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
    expect(result.fileName).toMatch(/^contract_\d+\.docx$/);
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
        agentBankName: "Org Bank",
        agentFee: "1.25",
        fixedFee: "100",
      }),
      "ru",
      IDS.organization,
    );
  });

  it("renders a client contract from typed nested DTOs", async () => {
    const { templateRenderer, workflow } = createWorkflow();

    await workflow.renderClientContract({
      agreement: {
        id: IDS.agreement,
        contractNumber: "AG-typed",
        contractDate: "2026-04-01",
        agentFee: "1.50",
        fixedFee: "25",
      },
      client: {
        id: "client-typed",
        orgName: "Client LLC",
        orgNameI18n: { ru: "Клиент", en: "Client LLC" },
        orgType: "LLC",
        orgTypeI18n: { ru: "ООО", en: "LLC" },
        directorName: "Иван Иванов",
        directorNameI18n: { ru: "Иван Иванов", en: "Ivan Ivanov" },
        directorBasis: "Устава",
        directorBasisI18n: { ru: "Устава", en: "Articles" },
        address: "Moscow",
        addressI18n: { ru: "Москва", en: "Moscow" },
        inn: "7700000000",
        kpp: "770001001",
        account: "40702810900000000002",
        corrAccount: "30101810400000000226",
        bic: "044030653",
        bankName: "Client Bank",
        bankNameI18n: null,
        bankAddress: "Saint Petersburg",
        bankAddressI18n: null,
      },
      organization: {
        id: IDS.organization,
        nameI18n: { ru: "Мультиханса", en: "Multihansa" },
        addressI18n: { ru: "Тверская 1", en: "1 Tverskaya" },
        countryI18n: { ru: "Россия", en: "Russia" },
        cityI18n: { ru: "Москва", en: "Moscow" },
        directorNameI18n: { ru: "Петр Петров", en: "Peter Petrov" },
        inn: "1234567890",
        taxId: "1234567890",
        kpp: "123456789",
        signatureKey: `organizations/${IDS.organization}/signature.png`,
        sealKey: `organizations/${IDS.organization}/seal.png`,
      },
      organizationRequisite: {
        id: IDS.organizationRequisite,
        accountNo: "40702810900000000001",
        bic: "044525225",
        corrAccount: "30101810400000000225",
        currencyCode: "USD",
        institutionName: "Org Bank",
        ownerId: IDS.organization,
        swift: "ORGSRUMM",
      },
    });

    expect(templateRenderer.renderDocx).toHaveBeenCalledWith(
      "contract",
      expect.objectContaining({
        contractNumber: "AG-typed",
        agentBankName: "Org Bank",
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
    const { workflow } = createWorkflow();

    await expect(
      workflow.renderClientContract({
        agreement: {
          id: IDS.agreement,
          contractNumber: "AG-typed",
          contractDate: "2026-04-01",
          agentFee: null,
          fixedFee: null,
        },
        client: {
          id: "client-typed",
          orgName: "Client LLC",
          orgNameI18n: null,
          orgType: null,
          orgTypeI18n: null,
          directorName: null,
          directorNameI18n: null,
          directorBasis: null,
          directorBasisI18n: null,
          address: null,
          addressI18n: null,
          inn: null,
          kpp: null,
          account: null,
          corrAccount: null,
          bic: null,
          bankName: null,
          bankNameI18n: null,
          bankAddress: null,
          bankAddressI18n: null,
        },
        organization: {
          id: IDS.organization,
          nameI18n: null,
          addressI18n: null,
          countryI18n: null,
          cityI18n: null,
          directorNameI18n: null,
          inn: null,
          taxId: null,
          kpp: null,
          signatureKey: null,
          sealKey: null,
        },
        organizationRequisite: {
          id: IDS.organizationRequisite,
          accountNo: null,
          bic: null,
          corrAccount: null,
          currencyCode: "USD",
          institutionName: null,
          ownerId: IDS.organization,
          swift: null,
        },
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
      }),
    ).rejects.toBeInstanceOf(OrganizationFileMissingInStorageError);
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
});
