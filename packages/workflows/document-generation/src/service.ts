import type { AgreementsModule } from "@bedrock/agreements";
import type { AgreementDetails } from "@bedrock/agreements/contracts";
import type { CurrenciesService } from "@bedrock/currencies";
import type { PartiesModule } from "@bedrock/parties";
import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";
import { hasOnlyAsciiDigits } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";

import {
  GenerateCustomerContractInputSchema,
  GenerateDocumentInputSchema,
  type ClientContractAgreement,
  type ClientContractClient,
  type ClientContractOrganization,
  type ClientContractOrganizationBankRequisite,
  type ClientContractFormat,
  type DocumentLanguage,
  type GenerateCustomerContractInput,
  type GenerateDocumentInput,
  type GeneratedDocument,
  type RenderClientContractInput,
} from "./contracts";
import {
  assembleAcceptanceData,
  assembleApplicationData,
  assembleCalculationData,
  assembleClientContractData,
  assembleInvoiceData,
  bufferToImageContent,
} from "./data-assembly";
import type { DocumentFormat, DocumentLang, OrgFiles } from "./data-assembly";
import {
  CustomerContractNotFoundError,
  CustomerContractOrganizationNotFoundError,
  OrganizationFileMissingInStorageError,
  OrganizationFilesNotConfiguredError,
} from "./errors";

export interface TemplateRendererPort {
  renderDocx(
    templateType: string,
    data: Record<string, unknown>,
    locale: string,
    organizationId?: string,
  ): Promise<Buffer>;
}

export interface PdfConverterPort {
  convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer>;
}

export interface TemplateManagerPort {
  parseTags(templateType: string, organizationId?: string): Promise<string[]>;
  listTemplates(organizationId?: string): Promise<string[]>;
}

export interface ObjectStoragePort {
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export interface DocumentGenerationWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  currencies: Pick<CurrenciesService, "findById">;
  logger: Logger;
  objectStorage?: ObjectStoragePort;
  parties: Pick<PartiesModule, "counterparties" | "organizations" | "requisites">;
  pdfConverter: PdfConverterPort;
  templateManager?: TemplateManagerPort;
  templateRenderer: TemplateRendererPort;
}

const MIME_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function isPositiveDecimalString(value: string): boolean {
  const separatorIndex = value.indexOf(".");

  if (separatorIndex === -1) {
    return hasOnlyAsciiDigits(value);
  }

  if (
    separatorIndex === 0 ||
    separatorIndex === value.length - 1 ||
    separatorIndex !== value.lastIndexOf(".")
  ) {
    return false;
  }

  return (
    hasOnlyAsciiDigits(value.slice(0, separatorIndex)) &&
    hasOnlyAsciiDigits(value.slice(separatorIndex + 1))
  );
}

function trimLeadingZeros(value: string): string {
  let firstNonZeroIndex = 0;

  while (
    firstNonZeroIndex < value.length - 1 &&
    value[firstNonZeroIndex] === "0"
  ) {
    firstNonZeroIndex += 1;
  }

  return value.slice(firstNonZeroIndex) || "0";
}

function trimTrailingZeros(value: string): string {
  let endIndex = value.length;

  while (endIndex > 0 && value[endIndex - 1] === "0") {
    endIndex -= 1;
  }

  return value.slice(0, endIndex);
}

function normalizeDecimalString(value: string): string {
  const [wholeRaw = "0", fractionRaw = ""] = value.split(".");
  const whole = trimLeadingZeros(wholeRaw);
  const fraction = trimTrailingZeros(fractionRaw);

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function shiftPositiveDecimalString(value: string, decimalPlaces: number): string {
  if (!isPositiveDecimalString(value)) {
    return value;
  }

  const [wholeRaw, fractionRaw = ""] = value.split(".");
  const digits = trimLeadingZeros(`${wholeRaw}${fractionRaw}`);
  const nextScale = fractionRaw.length - decimalPlaces;

  if (digits === "0") {
    return "0";
  }

  if (nextScale <= 0) {
    return normalizeDecimalString(`${digits}${"0".repeat(-nextScale)}`);
  }

  if (nextScale >= digits.length) {
    return normalizeDecimalString(
      `0.${"0".repeat(nextScale - digits.length)}${digits}`,
    );
  }

  const integerPart = digits.slice(0, digits.length - nextScale);
  const fractionPart = digits.slice(digits.length - nextScale);

  return normalizeDecimalString(`${integerPart}.${fractionPart}`);
}

function formatContractDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function serializeAgreementFees(agreement: AgreementDetails) {
  let agentFee: string | null = null;
  let fixedFee: string | null = null;

  for (const rule of agreement.currentVersion.feeRules) {
    if (rule.kind === "agent_fee") {
      agentFee = shiftPositiveDecimalString(rule.value, -2);
      continue;
    }

    if (rule.kind === "fixed_fee") {
      fixedFee = normalizeDecimalString(rule.value);
    }
  }

  return { agentFee, fixedFee };
}

function serializeAgreementForClientContract(
  agreement: AgreementDetails,
): ClientContractAgreement {
  const fees = serializeAgreementFees(agreement);

  return {
    id: agreement.id,
    contractNumber: agreement.currentVersion.contractNumber,
    contractDate: formatContractDate(agreement.currentVersion.contractDate),
    agentFee: fees.agentFee,
    fixedFee: fees.fixedFee,
  };
}

function mapClientContractClient(input: {
  counterparty: Counterparty;
  bankRequisite: Requisite | null;
  provider: RequisiteProvider | null;
}): ClientContractClient {
  const { bankRequisite, counterparty, provider } = input;

  return {
    id: counterparty.id,
    orgName: counterparty.shortName,
    orgNameI18n: counterparty.orgNameI18n ?? null,
    orgType: counterparty.orgType ?? null,
    orgTypeI18n: counterparty.orgTypeI18n ?? null,
    directorName: counterparty.directorName ?? null,
    directorNameI18n: counterparty.directorNameI18n ?? null,
    directorBasis: counterparty.directorBasis ?? null,
    directorBasisI18n: counterparty.directorBasisI18n ?? null,
    address: counterparty.address ?? null,
    addressI18n: counterparty.addressI18n ?? null,
    inn: counterparty.inn ?? counterparty.externalId ?? null,
    kpp: counterparty.kpp ?? null,
    account: bankRequisite?.accountNo ?? null,
    corrAccount: bankRequisite?.corrAccount ?? null,
    bic: provider?.bic ?? null,
    bankName: provider?.name ?? null,
    bankNameI18n: null,
    bankAddress: provider?.address ?? null,
    bankAddressI18n: null,
  };
}

function mapClientContractOrganization(
  organization: Organization,
): ClientContractOrganization {
  return {
    id: organization.id,
    nameI18n: organization.nameI18n ?? null,
    addressI18n: organization.addressI18n ?? null,
    countryI18n: organization.countryI18n ?? null,
    cityI18n: organization.cityI18n ?? null,
    directorNameI18n: organization.directorNameI18n ?? null,
    inn: organization.inn ?? null,
    taxId: organization.taxId ?? null,
    kpp: organization.kpp ?? null,
    signatureKey: organization.signatureKey ?? null,
    sealKey: organization.sealKey ?? null,
  };
}

function mapClientContractOrganizationRequisite(input: {
  currencyCode: string;
  provider: RequisiteProvider | null;
  requisite: Requisite;
}): ClientContractOrganizationBankRequisite {
  const { currencyCode, provider, requisite } = input;

  return {
    id: requisite.id,
    accountNo: requisite.accountNo ?? null,
    bic: provider?.bic ?? null,
    corrAccount: requisite.corrAccount ?? null,
    currencyCode,
    institutionName: provider?.name ?? null,
    ownerId: requisite.ownerId,
    swift: provider?.swift ?? null,
  };
}

function isMissingStorageKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("The specified key does not exist");
}

async function findProviderByIdOrNull(
  parties: Pick<PartiesModule, "requisites">,
  providerId: string | null | undefined,
): Promise<RequisiteProvider | null> {
  if (!providerId) {
    return null;
  }

  return parties.requisites.queries.findProviderById(providerId);
}

export function createDocumentGenerationWorkflow(
  deps: DocumentGenerationWorkflowDeps,
) {
  async function renderAndConvert(
    templateType: string,
    data: Record<string, unknown>,
    locale: string,
    format: DocumentFormat,
    organizationId?: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const docxBuffer = await deps.templateRenderer.renderDocx(
      templateType,
      data,
      locale,
      organizationId,
    );

    if (format === "pdf") {
      const pdfBuffer = await deps.pdfConverter.convertDocxToPdf(docxBuffer);
      return { buffer: pdfBuffer, mimeType: MIME_TYPES.pdf! };
    }

    return { buffer: docxBuffer, mimeType: MIME_TYPES.docx! };
  }

  async function fetchOrgFiles(
    organization: Record<string, unknown>,
  ): Promise<OrgFiles> {
    if (!deps.objectStorage) {
      throw new Error("Object storage not configured");
    }

    const organizationId =
      typeof organization.id === "string" ? organization.id : null;
    const signatureKey =
      typeof organization.signatureKey === "string"
        ? organization.signatureKey
        : organizationId
          ? `organizations/${organizationId}/signature.png`
          : null;
    const sealKey =
      typeof organization.sealKey === "string"
        ? organization.sealKey
        : organizationId
          ? `organizations/${organizationId}/seal.png`
          : null;

    if (!signatureKey || !sealKey) {
      throw new Error("Organization files are not configured");
    }

    const [signatureBuffer, sealBuffer] = await Promise.all([
      deps.objectStorage.download(signatureKey),
      deps.objectStorage.download(sealKey),
    ]);

    return {
      signature: bufferToImageContent(signatureBuffer, 150, 50),
      stamp: bufferToImageContent(sealBuffer, 200, 200),
    };
  }

  async function fetchConfiguredOrgFiles(
    organization: ClientContractOrganization,
  ): Promise<OrgFiles> {
    if (!deps.objectStorage) {
      throw new Error("Object storage not configured");
    }

    if (!organization.signatureKey || !organization.sealKey) {
      throw new OrganizationFilesNotConfiguredError();
    }

    try {
      const [signatureBuffer, sealBuffer] = await Promise.all([
        deps.objectStorage.download(organization.signatureKey),
        deps.objectStorage.download(organization.sealKey),
      ]);

      return {
        signature: bufferToImageContent(signatureBuffer, 150, 50),
        stamp: bufferToImageContent(sealBuffer, 200, 200),
      };
    } catch (error) {
      if (isMissingStorageKeyError(error)) {
        throw new OrganizationFileMissingInStorageError();
      }

      throw error;
    }
  }

  async function renderClientContractInternal(
    input: RenderClientContractInput,
  ): Promise<GeneratedDocument> {
    const format = (input.format ?? "docx") as DocumentFormat;
    const lang = (input.lang ?? "ru") as DocumentLang;
    const orgFiles = await fetchConfiguredOrgFiles(input.organization);

    const data = assembleClientContractData(
      input.client,
      input.agreement,
      input.organization,
      input.organizationRequisite,
      orgFiles,
      lang,
    );

    const { buffer, mimeType } = await renderAndConvert(
      "contract",
      data,
      lang,
      format,
      input.organization.id,
    );

    const ext = format === "pdf" ? "pdf" : "docx";
    const fileName = `contract_${Date.now()}.${ext}`;

    return { fileName, mimeType, buffer };
  }

  return {
    async generate(input: GenerateDocumentInput): Promise<GeneratedDocument> {
      const validated = GenerateDocumentInputSchema.parse(input);

      const { buffer, mimeType } = await renderAndConvert(
        validated.templateType,
        validated.data,
        validated.locale,
        validated.outputFormat as DocumentFormat,
      );

      const fileName = `${validated.templateType}_${Date.now()}.${validated.outputFormat}`;

      deps.logger.info("Document generated", {
        templateType: validated.templateType,
        outputFormat: validated.outputFormat,
        locale: validated.locale,
        fileName,
      });

      return { fileName, mimeType, buffer };
    },

    async renderClientContract(
      input: RenderClientContractInput,
    ): Promise<GeneratedDocument> {
      return renderClientContractInternal(input);
    },

    async generateCustomerContract(
      input: GenerateCustomerContractInput,
    ): Promise<GeneratedDocument> {
      const validated = GenerateCustomerContractInputSchema.parse(input);
      const counterparty =
        await deps.parties.counterparties.queries.findById(
          validated.counterpartyId,
        );

      if (
        !counterparty ||
        counterparty.customerId !== validated.customerId ||
        counterparty.relationshipKind !== "customer_owned"
      ) {
        throw new NotFoundError(
          "Customer counterparty",
          validated.counterpartyId,
        );
      }

      const agreement =
        await deps.agreements.agreements.queries.findActiveByCustomerId(
          validated.customerId,
        );

      if (!agreement) {
        throw new CustomerContractNotFoundError();
      }

      const organization =
        await deps.parties.organizations.queries.findById(
          agreement.organizationId,
        );
      const organizationRequisite =
        await deps.parties.requisites.queries.findOrganizationBankById(
          agreement.organizationRequisiteId,
        );

      if (
        !organization ||
        !organizationRequisite ||
        organizationRequisite.ownerId !== organization.id
      ) {
        throw new CustomerContractOrganizationNotFoundError();
      }

      const counterpartyBankRequisite =
        await deps.parties.requisites.queries.findPreferredCounterpartyBankByCounterpartyId(
          validated.counterpartyId,
        );

      const [
        organizationCurrency,
        organizationProvider,
        counterpartyProvider,
      ] = await Promise.all([
        deps.currencies.findById(organizationRequisite.currencyId),
        findProviderByIdOrNull(
          deps.parties,
          organizationRequisite.providerId,
        ),
        findProviderByIdOrNull(
          deps.parties,
          counterpartyBankRequisite?.providerId,
        ),
      ]);

      return renderClientContractInternal({
        agreement: serializeAgreementForClientContract(agreement),
        client: mapClientContractClient({
          counterparty,
          bankRequisite: counterpartyBankRequisite,
          provider: counterpartyProvider,
        }),
        format: validated.format as ClientContractFormat | undefined,
        lang: validated.lang as DocumentLanguage | undefined,
        organization: mapClientContractOrganization(organization),
        organizationRequisite: mapClientContractOrganizationRequisite({
          currencyCode: organizationCurrency.code,
          provider: organizationProvider,
          requisite: organizationRequisite,
        }),
      });
    },

    async generateDealDocument(input: {
      templateType: "application" | "invoice" | "acceptance";
      deal: Record<string, unknown>;
      calculation: Record<string, unknown>;
      client: Record<string, unknown>;
      contract: Record<string, unknown>;
      organization: Record<string, unknown>;
      organizationRequisite: Record<string, unknown>;
      date?: Date;
      format?: DocumentFormat;
      lang?: DocumentLang;
    }): Promise<GeneratedDocument> {
      const format = input.format ?? "docx";
      const lang = input.lang ?? "ru";
      const date = input.date ?? new Date();
      const orgFiles = await fetchOrgFiles(input.organization);

      const assemblers = {
        application: assembleApplicationData,
        invoice: assembleInvoiceData,
        acceptance: assembleAcceptanceData,
      };

      const data = assemblers[input.templateType](
        input.deal,
        input.calculation,
        input.client,
        input.contract,
        input.organization,
        input.organizationRequisite,
        orgFiles,
        date,
        lang,
      );

      const { buffer, mimeType } = await renderAndConvert(
        input.templateType,
        data,
        lang,
        format,
        typeof input.organization.id === "string"
          ? input.organization.id
          : undefined,
      );

      const ext = format === "pdf" ? "pdf" : "docx";
      const fileName = `${input.templateType}_${Date.now()}.${ext}`;

      return { fileName, mimeType, buffer };
    },

    async generateCalculation(input: {
      calculationData: Record<string, unknown>;
      format?: DocumentFormat;
      lang?: DocumentLang;
      organizationId?: string;
    }): Promise<GeneratedDocument> {
      const format = input.format ?? "pdf";
      const lang = input.lang ?? "ru";

      const data = assembleCalculationData(input.calculationData, lang);

      const { buffer, mimeType } = await renderAndConvert(
        "calculation",
        data,
        lang,
        format,
        input.organizationId,
      );

      const ext = format === "pdf" ? "pdf" : "docx";
      const fileName = `calculation_${Date.now()}.${ext}`;

      return { fileName, mimeType, buffer };
    },

    async generateFromRawData(input: {
      templateName: string;
      data: Record<string, string>;
      format?: DocumentFormat;
      organizationId?: string;
    }): Promise<GeneratedDocument> {
      const format = input.format ?? "docx";
      const mergedData: Record<string, unknown> = { ...input.data };

      if (input.organizationId && deps.objectStorage) {
        try {
          const orgFiles = await fetchOrgFiles({
            id: input.organizationId,
          });
          mergedData.signature = orgFiles.signature;
          mergedData.stamp = orgFiles.stamp;
        } catch {
          deps.logger.warn(
            "Could not load organization files for raw data generation",
            { organizationId: input.organizationId },
          );
        }
      }

      const templateType = input.templateName.replace(/\.docx$/, "");
      const { buffer, mimeType } = await renderAndConvert(
        templateType,
        mergedData,
        "ru",
        format,
        input.organizationId,
      );

      const ext = format === "pdf" ? "pdf" : "docx";
      const fileName = `${templateType}_${Date.now()}.${ext}`;

      return { fileName, mimeType, buffer };
    },

    async listTemplates(organizationId?: string): Promise<string[]> {
      if (!deps.templateManager) return [];
      return deps.templateManager.listTemplates(organizationId);
    },

    async getTemplateFields(
      templateName: string,
      organizationId?: string,
    ): Promise<string[]> {
      if (!deps.templateManager) return [];
      return deps.templateManager.parseTags(templateName, organizationId);
    },
  };
}

export type DocumentGenerationWorkflow = ReturnType<
  typeof createDocumentGenerationWorkflow
>;
