import { z } from "zod";

import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";

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
export const PRINT_FORM_OWNER_TYPES = [
  "agreement_version",
  "calculation",
  "deal",
  "document",
] as const;
export const PRINT_FORM_LANGUAGE_MODES = ["single", "bilingual"] as const;
export const PRINT_FORM_QUALITY_VALUES = ["ready", "draft"] as const;
export const PRINT_FORM_WARNING_CODES = [
  "missing_signing_asset",
  "missing_translation",
  "missing_source_data",
] as const;

export type ClientContractFormat = (typeof CLIENT_CONTRACT_FORMATS)[number];
export type DocumentLanguage = (typeof DOCUMENT_LANGS)[number];
export type PrintFormOwnerType = (typeof PRINT_FORM_OWNER_TYPES)[number];
export type PrintFormLanguageMode =
  (typeof PRINT_FORM_LANGUAGE_MODES)[number];
export type PrintFormQuality = (typeof PRINT_FORM_QUALITY_VALUES)[number];
export type PrintFormWarningCode = (typeof PRINT_FORM_WARNING_CODES)[number];

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

export const PrintFormWarningSchema = z.object({
  code: z.enum(PRINT_FORM_WARNING_CODES),
  message: z.string(),
  field: z.string().optional(),
});

export const PrintFormDescriptorSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerType: z.enum(PRINT_FORM_OWNER_TYPES),
  formats: z.array(z.enum(CLIENT_CONTRACT_FORMATS)),
  languageMode: z.enum(PRINT_FORM_LANGUAGE_MODES),
  languages: z.array(z.enum(DOCUMENT_LANGS)),
  quality: z.enum(PRINT_FORM_QUALITY_VALUES),
  warnings: z.array(PrintFormWarningSchema),
});

export type PrintFormWarning = z.infer<typeof PrintFormWarningSchema>;
export type PrintFormDescriptor = z.infer<typeof PrintFormDescriptorSchema>;

export interface PrintFormDefinition {
  docTypes?: readonly string[];
  formats: readonly ClientContractFormat[];
  id: string;
  languageMode: PrintFormLanguageMode;
  languages: readonly DocumentLanguage[];
  ownerType: PrintFormOwnerType;
  requiredData: readonly string[];
  templateType: DocumentTemplateType;
  title: string;
}

export const PRINT_FORM_DEFINITIONS = [
  {
    docTypes: ["invoice"],
    formats: CLIENT_CONTRACT_FORMATS,
    id: "document.invoice-ru",
    languageMode: "single",
    languages: ["ru"],
    ownerType: "document",
    requiredData: [
      "document",
      "deal",
      "agreement",
      "counterparty",
      "organization",
      "organizationRequisite",
      "signingAssets",
    ],
    templateType: "invoice",
    title: "Счет на оплату",
  },
  {
    docTypes: ["invoice"],
    formats: CLIENT_CONTRACT_FORMATS,
    id: "document.invoice-en",
    languageMode: "single",
    languages: ["en"],
    ownerType: "document",
    requiredData: [
      "document",
      "deal",
      "agreement",
      "counterparty",
      "organization",
      "organizationRequisite",
      "signingAssets",
    ],
    templateType: "invoice",
    title: "Invoice",
  },
  {
    docTypes: ["acceptance"],
    formats: CLIENT_CONTRACT_FORMATS,
    id: "document.acceptance-bilingual",
    languageMode: "bilingual",
    languages: ["ru", "en"],
    ownerType: "document",
    requiredData: [
      "document",
      "deal",
      "agreement",
      "counterparty",
      "organization",
      "organizationRequisite",
      "signingAssets",
      "translations",
    ],
    templateType: "acceptance",
    title: "Acceptance / Акт",
  },
  {
    formats: CLIENT_CONTRACT_FORMATS,
    id: "deal.application",
    languageMode: "single",
    languages: ["ru"],
    ownerType: "deal",
    requiredData: [
      "deal",
      "agreement",
      "counterparty",
      "organization",
      "organizationRequisite",
      "calculation",
      "signingAssets",
    ],
    templateType: "application",
    title: "Заявка",
  },
  {
    formats: CLIENT_CONTRACT_FORMATS,
    id: "calculation.calculation-ru",
    languageMode: "single",
    languages: ["ru"],
    ownerType: "calculation",
    requiredData: ["calculationSnapshot", "currencies"],
    templateType: "calculation",
    title: "Расчет",
  },
  {
    formats: CLIENT_CONTRACT_FORMATS,
    id: "agreement_version.customer-contract-bilingual",
    languageMode: "bilingual",
    languages: ["ru", "en"],
    ownerType: "agreement_version",
    requiredData: [
      "agreementVersion",
      "customerCounterparty",
      "organization",
      "organizationRequisite",
      "signingAssets",
      "translations",
    ],
    templateType: "contract",
    title: "Customer contract / Договор",
  },
] as const satisfies readonly PrintFormDefinition[];

export function listPrintFormDefinitions(input: {
  docType?: string | null;
  ownerType: PrintFormOwnerType;
}): PrintFormDefinition[] {
  return PRINT_FORM_DEFINITIONS.filter((definition) => {
    if (definition.ownerType !== input.ownerType) {
      return false;
    }

    const docTypes = "docTypes" in definition ? definition.docTypes : null;

    if (!docTypes) {
      return true;
    }

    return Boolean(
      input.docType && (docTypes as readonly string[]).includes(input.docType),
    );
  });
}

export function findPrintFormDefinition(input: {
  docType?: string | null;
  formId: string;
  ownerType: PrintFormOwnerType;
}): PrintFormDefinition | null {
  return (
    listPrintFormDefinitions({
      docType: input.docType,
      ownerType: input.ownerType,
    }).find((definition) => definition.id === input.formId) ?? null
  );
}

export function toPrintFormDescriptor(
  definition: PrintFormDefinition,
  input?: {
    quality?: PrintFormQuality;
    warnings?: PrintFormWarning[];
  },
): PrintFormDescriptor {
  return {
    id: definition.id,
    title: definition.title,
    ownerType: definition.ownerType,
    formats: [...definition.formats],
    languageMode: definition.languageMode,
    languages: [...definition.languages],
    quality: input?.quality ?? "ready",
    warnings: input?.warnings ?? [],
  };
}

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

export interface CalculationDocumentData {
  additionalExpenses: string;
  additionalExpensesInBase: string;
  agreementFeeAmount: string;
  agreementFeePercentage: string;
  baseCurrencyCode: string;
  calculationTimestamp: string;
  currencyCode: string;
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  finalRate: string;
  id: string;
  originalAmount: string;
  quoteMarkupAmount: string;
  quoteMarkupPercentage: string;
  rate: string;
  rateSource: string;
  totalFeeAmount: string;
  totalFeeAmountInBase: string;
  totalFeePercentage: string;
  totalAmount: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
}

export interface RenderClientContractInput {
  agreement: ClientContractAgreement;
  clientBankProvider: RequisiteProvider | null;
  clientBankRequisite: Requisite | null;
  clientCounterparty: Counterparty;
  format?: ClientContractFormat;
  lang?: DocumentLanguage;
  organization: Organization;
  organizationRequisite: Requisite;
  organizationRequisiteProvider: RequisiteProvider | null;
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
