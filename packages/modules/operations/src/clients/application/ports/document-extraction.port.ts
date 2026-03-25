export interface DocumentExtractionPort {
  extractFromPdf(buffer: Buffer): Promise<ExtractedClientData>;
  extractFromDocx(buffer: Buffer): Promise<ExtractedClientData>;
  extractFromXlsx(buffer: Buffer): Promise<ExtractedClientData>;
}

export interface ExtractedClientData {
  companyName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  address?: string | null;
  directorName?: string | null;
  directorPosition?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bic?: string | null;
  corrAccount?: string | null;
}
