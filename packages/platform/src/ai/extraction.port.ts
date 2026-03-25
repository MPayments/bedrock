import type { ExtractedDocumentData } from "./contracts";

export interface DocumentExtractionPort {
  extractFromPdf(buffer: Buffer): Promise<ExtractedDocumentData>;
  extractFromDocx(buffer: Buffer): Promise<ExtractedDocumentData>;
  extractFromXlsx(buffer: Buffer): Promise<ExtractedDocumentData>;
  translateFields(
    data: Record<string, string>,
    fromLang: string,
    toLang: string,
  ): Promise<Record<string, string>>;
}
