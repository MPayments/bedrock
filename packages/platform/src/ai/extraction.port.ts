import type { z } from "zod";

import type { ExtractedDocumentData } from "./contracts";

export interface DocumentExtractionPort {
  extractFromPdf(buffer: Buffer): Promise<ExtractedDocumentData>;
  extractFromDocx(buffer: Buffer): Promise<ExtractedDocumentData>;
  extractFromXlsx(buffer: Buffer): Promise<ExtractedDocumentData>;
  extractFromBuffer<T extends z.ZodTypeAny>(
    buffer: Buffer,
    mimeType: string,
    schema: T,
  ): Promise<z.infer<T>>;
  translateFields(
    data: Record<string, string>,
    fromLang: string,
    toLang: string,
  ): Promise<Record<string, string>>;
}
