export type DealStatus =
  | "draft"
  | "submitted"
  | "rejected"
  | "preparing_documents"
  | "awaiting_funds"
  | "awaiting_payment"
  | "closing_documents"
  | "done"
  | "cancelled";

export type DealType =
  | "payment"
  | "currency_exchange"
  | "currency_transit"
  | "exporter_settlement";

export type ApiDealParticipant = {
  counterpartyId: string | null;
  customerId: string | null;
  id: string;
  organizationId: string | null;
  partyId: string;
  role: "customer" | "organization" | "counterparty";
};

export type ApiDealStatusHistory = {
  changedBy: string | null;
  comment: string | null;
  createdAt: string;
  id: string;
  status: DealStatus;
};

export type ApiDealDetails = {
  agreementId: string;
  agentId: string | null;
  approvals: {
    approvalType: string;
    comment: string | null;
    decidedAt: string | null;
    decidedBy: string | null;
    id: string;
    requestedAt: string;
    requestedBy: string | null;
    status: string;
  }[];
  calculationId: string | null;
  comment: string | null;
  createdAt: string;
  customerId: string;
  id: string;
  intakeComment: string | null;
  participants: ApiDealParticipant[];
  reason: string | null;
  requestedAmount: string | null;
  requestedCurrencyId: string | null;
  status: DealStatus;
  statusHistory: ApiDealStatusHistory[];
  type: DealType;
  updatedAt: string;
};

export type ApiCalculationDetails = {
  createdAt: string;
  currentSnapshot: {
    additionalExpensesAmountMinor: string;
    additionalExpensesCurrencyId: string | null;
    additionalExpensesInBaseMinor: string;
    baseCurrencyId: string;
    calculationCurrencyId: string;
    calculationTimestamp: string;
    feeAmountInBaseMinor: string;
    feeAmountMinor: string;
    feeBps: string;
    rateDen: string;
    rateNum: string;
    originalAmountMinor: string;
    totalAmountMinor: string;
    totalInBaseMinor: string;
    totalWithExpensesInBaseMinor: string;
  };
  id: string;
  isActive: boolean;
  updatedAt: string;
};

export type ApiCurrency = {
  code: string;
  id: string;
  precision: number;
};

export type ApiCurrencyOption = {
  code: string;
  id: string;
  label: string;
  name: string;
};

import type { AgreementFeeRuleView } from "@/lib/utils/agreement-fee-format";

export type ApiAgreementFeeRule = AgreementFeeRuleView & {
  id: string;
};

export type ApiAgreementDetails = {
  currentVersion: {
    contractDate: string | null;
    contractNumber: string | null;
    feeRules: ApiAgreementFeeRule[];
    id: string;
    versionNumber: number;
  };
  id: string;
  isActive: boolean;
  organizationId: string;
  organizationRequisiteId: string;
};

export type ApiCustomerLegalEntity = {
  account: string | null;
  beneficiaryName: string | null;
  bic: string | null;
  corrAccount: string | null;
  counterpartyId: string;
  directorBasis: string | null;
  directorName: string | null;
  email: string | null;
  fullName: string;
  iban: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  orgName: string;
  phone: string | null;
  position: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  subAgent: {
    commissionRate: number;
    counterpartyId: string;
    fullName: string;
    kind: "individual" | "legal_entity";
    shortName: string;
  } | null;
  swift: string | null;
  vatId: string | null;
};

export type ApiCustomerWorkspace = {
  description: string | null;
  displayName: string;
  externalRef: string | null;
  id: string;
  legalEntities: ApiCustomerLegalEntity[];
  orgName: string | null;
  shortName: string | null;
};

export type ApiOrganization = {
  address: string | null;
  fullName: string;
  id: string;
  inn: string | null;
  kpp: string | null;
  shortName: string;
};

export type ApiRequisite = {
  accountNo: string | null;
  corrAccount: string | null;
  iban: string | null;
  id: string;
  label: string;
};

export type ApiRequisiteProvider = {
  address: string | null;
  bic: string | null;
  country: string | null;
  id: string;
  name: string;
  swift: string | null;
};

export type ApiAttachment = {
  createdAt: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  updatedAt: string;
  uploadedBy: string | null;
};

export type ApiFormalDocument = {
  amount: string | null;
  approvalStatus: string;
  createdAt: string;
  currency: string | null;
  docType: string;
  id: string;
  lifecycleStatus: string;
  postingStatus: string;
  submissionStatus: string;
  title: string | null;
};

export type ApiDealCalculationHistoryItem = {
  baseCurrencyId: string;
  calculationCurrencyId: string;
  calculationId: string;
  calculationTimestamp: string;
  createdAt: string;
  feeAmountMinor: string;
  fxQuoteId: string | null;
  originalAmountMinor: string;
  rateDen: string;
  rateNum: string;
  sourceQuoteId: string | null;
  totalAmountMinor: string;
  totalInBaseMinor: string;
  totalWithExpensesInBaseMinor: string;
};

export type CalculationView = {
  additionalExpenses: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesInBase: string;
  baseCurrencyCode: string;
  currencyCode: string;
  feeAmount: string;
  feeAmountInBase: string;
  feePercentage: string;
  originalAmount: string;
  rate: string;
  totalAmount: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
};

export type CalculationHistoryView = {
  calculationId: string;
  calculationTimestamp: string;
  createdAt: string;
  fxQuoteId: string | null;
  rate: string;
};

export type DealPageData = {
  agreement: ApiAgreementDetails;
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  calculationHistory: CalculationHistoryView[];
  customer: ApiCustomerWorkspace;
  deal: ApiDealDetails;
  formalDocuments: ApiFormalDocument[];
  legalEntity: ApiCustomerLegalEntity | null;
  organization: ApiOrganization;
  organizationRequisite: ApiRequisite;
  organizationRequisiteProvider: ApiRequisiteProvider | null;
  requestedCurrency: ApiCurrency | null;
  currencyOptions: ApiCurrencyOption[];
};
