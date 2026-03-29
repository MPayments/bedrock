import type { Logger } from "@bedrock/platform/observability/logger";

import type { ObjectStoragePort } from "@bedrock/operations/shared-ports";

import {
  assembleAcceptanceData,
  assembleApplicationData,
  assembleCalculationData,
  assembleClientContractData,
  assembleInvoiceData,
  bufferToImageContent,
} from "./data-assembly";
import type { OrgFiles, DocumentLang, DocumentFormat } from "./data-assembly";
import {
  GenerateDocumentInputSchema,
  type GenerateDocumentInput,
  type GeneratedDocument,
} from "./contracts";

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

export interface DocumentGenerationWorkflowDeps {
  templateRenderer: TemplateRendererPort;
  pdfConverter: PdfConverterPort;
  templateManager?: TemplateManagerPort;
  objectStorage?: ObjectStoragePort;
  logger: Logger;
}

const MIME_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

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

    async generateClientContract(input: {
      client: Record<string, unknown>;
      contract: Record<string, unknown>;
      organization: Record<string, unknown>;
      organizationBank: Record<string, unknown>;
      format?: DocumentFormat;
      lang?: DocumentLang;
    }): Promise<GeneratedDocument> {
      const format = input.format ?? "docx";
      const lang = input.lang ?? "ru";
      const orgFiles = await fetchOrgFiles(input.organization);

      const data = assembleClientContractData(
        input.client,
        input.contract,
        input.organization,
        input.organizationBank,
        orgFiles,
        lang,
      );

      const { buffer, mimeType } = await renderAndConvert(
        "contract",
        data,
        lang,
        format,
        typeof input.organization.id === "string"
          ? input.organization.id
          : undefined,
      );

      const ext = format === "pdf" ? "pdf" : "docx";
      const fileName = `contract_${Date.now()}.${ext}`;

      return { fileName, mimeType, buffer };
    },

    async generateDealDocument(input: {
      templateType: "application" | "invoice" | "acceptance";
      deal: Record<string, unknown>;
      calculation: Record<string, unknown>;
      client: Record<string, unknown>;
      contract: Record<string, unknown>;
      organization: Record<string, unknown>;
      organizationBank: Record<string, unknown>;
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
        input.organizationBank,
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
