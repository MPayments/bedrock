import type { Logger } from "@bedrock/platform/observability/logger";

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
  ): Promise<Buffer>;
}

export interface PdfConverterPort {
  convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer>;
}

export interface DocumentGenerationWorkflowDeps {
  templateRenderer: TemplateRendererPort;
  pdfConverter: PdfConverterPort;
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
  return {
    async generate(input: GenerateDocumentInput): Promise<GeneratedDocument> {
      const validated = GenerateDocumentInputSchema.parse(input);

      const docxBuffer = await deps.templateRenderer.renderDocx(
        validated.templateType,
        validated.data,
        validated.locale,
      );

      let buffer: Buffer;
      if (validated.outputFormat === "pdf") {
        buffer = await deps.pdfConverter.convertDocxToPdf(docxBuffer);
      } else {
        buffer = docxBuffer;
      }

      const fileName = `${validated.templateType}_${Date.now()}.${validated.outputFormat}`;

      deps.logger.info("Document generated", {
        templateType: validated.templateType,
        outputFormat: validated.outputFormat,
        locale: validated.locale,
        fileName,
      });

      return {
        fileName,
        mimeType: MIME_TYPES[validated.outputFormat] ?? "application/octet-stream",
        buffer,
      };
    },
  };
}

export type DocumentGenerationWorkflow = ReturnType<
  typeof createDocumentGenerationWorkflow
>;
