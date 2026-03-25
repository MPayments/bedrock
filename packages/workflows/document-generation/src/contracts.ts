import { z } from "zod";

export const DOCUMENT_TEMPLATE_TYPES = [
  "contract",
  "invoice",
  "application",
  "calculation",
  "acceptance",
] as const;

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export const GenerateDocumentInputSchema = z.object({
  templateType: z.enum(DOCUMENT_TEMPLATE_TYPES),
  data: z.record(z.string(), z.unknown()),
  locale: z.enum(["ru", "en"]).default("ru"),
  outputFormat: z.enum(["docx", "pdf", "xlsx"]).default("docx"),
});

export type GenerateDocumentInput = z.infer<typeof GenerateDocumentInputSchema>;

export const GeneratedDocumentSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  buffer: z.instanceof(Buffer),
});

export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;
