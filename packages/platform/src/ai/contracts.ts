export interface ExtractedDocumentData {
  companyName: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  directorName: string | null;
  directorPosition: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bic: string | null;
  corrAccount: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  number: string | null;
  additionalFields?: Record<string, string>;
}
