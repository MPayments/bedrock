import { z } from "zod";

export const DOCUMENT_TEMPLATE_TYPES = [
  "contract",
  "invoice",
  "application",
  "calculation",
  "acceptance",
] as const;

export type DocumentTemplateType = (typeof DOCUMENT_TEMPLATE_TYPES)[number];

export const CLIENT_CONTRACT_FORMATS = ["docx", "pdf"] as const;
export const DOCUMENT_LANGS = ["ru", "en"] as const;

export type ClientContractFormat = (typeof CLIENT_CONTRACT_FORMATS)[number];
export type DocumentLanguage = (typeof DOCUMENT_LANGS)[number];

export const GenerateDocumentInputSchema = z.object({
  templateType: z.enum(DOCUMENT_TEMPLATE_TYPES),
  data: z.record(z.string(), z.unknown()),
  locale: z.enum(DOCUMENT_LANGS).default("ru"),
  outputFormat: z.enum(["docx", "pdf", "xlsx"]).default("docx"),
});

export type GenerateDocumentInput = z.infer<typeof GenerateDocumentInputSchema>;

export const GeneratedDocumentSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  buffer: z.instanceof(Buffer),
});

export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

export interface DocumentLocalizedText {
  en?: string | null;
  ru?: string | null;
}

export interface ClientContractClient {
  id: string;
  orgName: string;
  orgNameI18n?: DocumentLocalizedText | null;
  orgType: string | null;
  orgTypeI18n?: DocumentLocalizedText | null;
  directorName: string | null;
  directorNameI18n?: DocumentLocalizedText | null;
  directorBasis: string | null;
  directorBasisI18n?: DocumentLocalizedText | null;
  address: string | null;
  addressI18n?: DocumentLocalizedText | null;
  inn: string | null;
  kpp: string | null;
  account: string | null;
  corrAccount: string | null;
  bic: string | null;
  bankName: string | null;
  bankNameI18n?: DocumentLocalizedText | null;
  bankAddress: string | null;
  bankAddressI18n?: DocumentLocalizedText | null;
}

export interface ClientContractAgreement {
  id: string;
  contractNumber: string | null;
  contractDate: string | null;
  agentFee: string | null;
  fixedFee: string | null;
}

export interface ClientContractOrganization {
  id: string;
  nameI18n?: DocumentLocalizedText | null;
  addressI18n?: DocumentLocalizedText | null;
  countryI18n?: DocumentLocalizedText | null;
  cityI18n?: DocumentLocalizedText | null;
  directorNameI18n?: DocumentLocalizedText | null;
  inn: string | null;
  taxId: string | null;
  kpp: string | null;
  signatureKey: string | null;
  sealKey: string | null;
}

export interface ClientContractOrganizationBankRequisite {
  id: string;
  accountNo: string | null;
  bic: string | null;
  corrAccount: string | null;
  currencyCode: string;
  institutionName: string | null;
  ownerId: string;
  swift: string | null;
}

export interface RenderClientContractInput {
  agreement: ClientContractAgreement;
  client: ClientContractClient;
  format?: ClientContractFormat;
  lang?: DocumentLanguage;
  organization: ClientContractOrganization;
  organizationRequisite: ClientContractOrganizationBankRequisite;
}

export const GenerateCustomerContractInputSchema = z.object({
  counterpartyId: z.uuid(),
  customerId: z.uuid(),
  format: z.enum(CLIENT_CONTRACT_FORMATS).optional(),
  lang: z.enum(DOCUMENT_LANGS).optional(),
});

export type GenerateCustomerContractInput = z.infer<
  typeof GenerateCustomerContractInputSchema
>;
