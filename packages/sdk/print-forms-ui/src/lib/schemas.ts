import { z } from "zod";

export const PrintFormFormatSchema = z.enum(["docx", "pdf"]);
export const PrintFormOwnerTypeSchema = z.enum([
  "agreement_version",
  "calculation",
  "deal",
  "document",
]);
export const PrintFormLanguageModeSchema = z.enum(["single", "bilingual"]);
export const PrintFormQualitySchema = z.enum(["ready", "draft"]);
export const PrintFormWarningCodeSchema = z.enum([
  "missing_signing_asset",
  "missing_translation",
  "missing_source_data",
]);

export const PrintFormWarningSchema = z.object({
  code: PrintFormWarningCodeSchema,
  message: z.string(),
  field: z.string().optional(),
});

export const PrintFormDescriptorSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerType: PrintFormOwnerTypeSchema,
  formats: z.array(PrintFormFormatSchema),
  languageMode: PrintFormLanguageModeSchema,
  languages: z.array(z.enum(["ru", "en"])),
  quality: PrintFormQualitySchema,
  warnings: z.array(PrintFormWarningSchema),
});

export const PrintFormDescriptorsSchema = z.array(PrintFormDescriptorSchema);

export type PrintFormFormat = z.infer<typeof PrintFormFormatSchema>;
export type PrintFormDescriptor = z.infer<typeof PrintFormDescriptorSchema>;
export type PrintFormWarning = z.infer<typeof PrintFormWarningSchema>;
