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

export type DealLegKind =
  | "collect"
  | "convert"
  | "transit_hold"
  | "payout"
  | "settle_exporter";

export type DealLegState =
  | "pending"
  | "ready"
  | "in_progress"
  | "done"
  | "blocked"
  | "skipped";

export type DealCapabilityKind =
  | "can_collect"
  | "can_fx"
  | "can_payout"
  | "can_transit"
  | "can_exporter_settle";

export type DealCapabilityStatus = "enabled" | "disabled" | "pending";

export type DealOperationalPositionKind =
  | "customer_receivable"
  | "provider_payable"
  | "intercompany_due_from"
  | "intercompany_due_to"
  | "in_transit"
  | "suspense"
  | "exporter_expected_receivable"
  | "fee_revenue"
  | "spread_revenue";

export type DealOperationalPositionState =
  | "not_applicable"
  | "pending"
  | "ready"
  | "in_progress"
  | "done"
  | "blocked";

export type ApiDealParticipant = {
  counterpartyId: string | null;
  customerId: string | null;
  id: string;
  organizationId: string | null;
  partyId: string;
  role: "customer" | "organization" | "counterparty";
};

export type ApiDealWorkflowParticipant = {
  counterpartyId: string | null;
  customerId: string | null;
  displayName: string | null;
  id: string;
  organizationId: string | null;
  role:
    | "customer"
    | "applicant"
    | "internal_entity"
    | "external_payer"
    | "external_beneficiary";
};

export type ApiDealWorkflowLeg = {
  idx: number;
  kind: DealLegKind;
  state: DealLegState;
};

export type ApiDealTransitionBlocker = {
  code: string;
  message: string;
  meta?: Record<string, unknown>;
};

export type ApiDealTransitionReadiness = {
  allowed: boolean;
  blockers: ApiDealTransitionBlocker[];
  targetStatus: DealStatus;
};

export type ApiDealTimelineEvent = {
  actor: {
    label: string | null;
    userId: string | null;
  } | null;
  id: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  type:
    | "deal_created"
    | "intake_saved"
    | "participant_changed"
    | "status_changed"
    | "quote_created"
    | "quote_accepted"
    | "quote_expired"
    | "quote_used"
    | "calculation_attached"
    | "attachment_uploaded"
    | "attachment_deleted"
    | "document_created"
    | "document_status_changed"
    | "leg_state_changed";
  visibility: "customer_safe" | "internal";
};

export type ApiDealSectionCompleteness = {
  blockingReasons: string[];
  complete: boolean;
  sectionId:
    | "common"
    | "moneyRequest"
    | "incomingReceipt"
    | "externalBeneficiary"
    | "settlementDestination";
};

export type ApiDealAcceptedQuote = {
  acceptedAt: string;
  acceptedByUserId: string;
  agreementVersionId: string | null;
  dealId: string;
  dealRevision: number;
  expiresAt: string | null;
  id: string;
  quoteId: string;
  quoteStatus: string;
  replacedByQuoteId: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  usedDocumentId: string | null;
} | null;

export type ApiDealCapabilityState = {
  applicantCounterpartyId: string | null;
  dealType: DealType;
  internalEntityOrganizationId: string | null;
  kind: DealCapabilityKind;
  note: string | null;
  reasonCode: string | null;
  status: DealCapabilityStatus;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type ApiDealOperationalPosition = {
  amountMinor: string | null;
  currencyId: string | null;
  kind: DealOperationalPositionKind;
  reasonCode: string | null;
  sourceRefs: string[];
  state: DealOperationalPositionState;
  updatedAt: string | null;
};

export type ApiDealOperationalState = {
  capabilities: ApiDealCapabilityState[];
  positions: ApiDealOperationalPosition[];
};

export type ApiDealWorkflowProjection = {
  acceptedQuote: ApiDealAcceptedQuote;
  executionPlan: ApiDealWorkflowLeg[];
  intake: {
    common: {
      applicantCounterpartyId: string | null;
      customerNote: string | null;
      requestedExecutionDate: string | null;
    };
    externalBeneficiary: {
      bankInstructionSnapshot: {
        accountNo: string | null;
        bankAddress: string | null;
        bankCountry: string | null;
        bankName: string | null;
        beneficiaryName: string | null;
        bic: string | null;
        corrAccount: string | null;
        iban: string | null;
        label: string | null;
        swift: string | null;
      } | null;
      beneficiaryCounterpartyId: string | null;
      beneficiarySnapshot: {
        country: string | null;
        displayName: string | null;
        inn: string | null;
        legalName: string | null;
      } | null;
    };
    incomingReceipt: {
      contractNumber: string | null;
      expectedAmount: string | null;
      expectedAt: string | null;
      expectedCurrencyId: string | null;
      invoiceNumber: string | null;
      payerCounterpartyId: string | null;
      payerSnapshot: {
        country: string | null;
        displayName: string | null;
        inn: string | null;
        legalName: string | null;
      } | null;
    };
    moneyRequest: {
      purpose: string | null;
      sourceAmount: string | null;
      sourceCurrencyId: string | null;
      targetCurrencyId: string | null;
    };
    settlementDestination: {
      bankInstructionSnapshot: {
        accountNo: string | null;
        bankAddress: string | null;
        bankCountry: string | null;
        bankName: string | null;
        beneficiaryName: string | null;
        bic: string | null;
        corrAccount: string | null;
        iban: string | null;
        label: string | null;
        swift: string | null;
      } | null;
      mode: "applicant_requisite" | "manual" | null;
      requisiteId: string | null;
    };
    type: DealType;
  };
  nextAction: string | null;
  operationalState: ApiDealOperationalState;
  participants: ApiDealWorkflowParticipant[];
  relatedResources: {
    attachments: {
      createdAt: string;
      fileName: string;
      id: string;
    }[];
    calculations: {
      createdAt: string;
      id: string;
      sourceQuoteId: string | null;
    }[];
    formalDocuments: {
      approvalStatus: string | null;
      createdAt: string | null;
      docType: string;
      id: string;
      lifecycleStatus: string | null;
      occurredAt: string | null;
      postingStatus: string | null;
      submissionStatus: string | null;
    }[];
    quotes: {
      expiresAt: string | null;
      id: string;
      status: string;
    }[];
  };
  revision: number;
  sectionCompleteness: ApiDealSectionCompleteness[];
  summary: {
    agreementId: string;
    agentId: string | null;
    calculationId: string | null;
    createdAt: string;
    id: string;
    status: DealStatus;
    type: DealType;
    updatedAt: string;
  };
  timeline: ApiDealTimelineEvent[];
  transitionReadiness: ApiDealTransitionReadiness[];
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
  counterpartyId: string;
  directorBasis: string | null;
  directorName: string | null;
  email: string | null;
  fullName: string;
  inn: string | null;
  kpp: string | null;
  orgName: string;
  phone: string | null;
  position: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
};

export type ApiCustomerWorkspace = {
  description: string | null;
  displayName: string;
  externalRef: string | null;
  id: string;
  legalEntities: ApiCustomerLegalEntity[];
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
  visibility: "customer_safe" | "internal" | null;
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
  workbench: ApiCrmDealWorkbenchProjection;
};

export type ApiCrmDealWorkbenchProjection = {
  acceptedQuote: ApiDealAcceptedQuote;
  actions: {
    canAcceptQuote: boolean;
    canChangeAgreement: boolean;
    canCreateCalculation: boolean;
    canCreateFormalDocument: boolean;
    canCreateQuote: boolean;
    canEditIntake: boolean;
    canReassignAssignee: boolean;
    canUploadAttachment: boolean;
  };
  approvals: ApiDealDetails["approvals"];
  assignee: {
    userId: string | null;
  };
  context: {
    agreement: ApiAgreementDetails | null;
    applicant: ApiCustomerLegalEntity | null;
    customer: ApiCustomerWorkspace | null;
    internalEntity: ApiOrganization | null;
    internalEntityRequisite: ApiRequisite | null;
    internalEntityRequisiteProvider: ApiRequisiteProvider | null;
  };
  documentRequirements: Array<{
    activeDocumentId: string | null;
    blockingReasons: string[];
    createAllowed: boolean;
    docType: string;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }>;
  editability: {
    agreement: boolean;
    assignee: boolean;
    intake: boolean;
  };
  evidenceRequirements: Array<{
    blockingReasons: string[];
    code: string;
    label: string;
    state: "missing" | "not_required" | "provided";
  }>;
  executionPlan: ApiDealWorkflowLeg[];
  intake: ApiDealWorkflowProjection["intake"];
  nextAction: string;
  operationalState: ApiDealOperationalState;
  participants: ApiDealWorkflowParticipant[];
  pricing: {
    calculationHistory: ApiDealCalculationHistoryItem[];
    currentCalculation: ApiCalculationDetails | null;
    quoteEligibility: boolean;
    quotes: ApiDealWorkflowProjection["relatedResources"]["quotes"];
  };
  relatedResources: {
    attachments: ApiAttachment[];
    formalDocuments: ApiDealWorkflowProjection["relatedResources"]["formalDocuments"];
  };
  sectionCompleteness: ApiDealSectionCompleteness[];
  summary: ApiDealWorkflowProjection["summary"] & {
    applicantDisplayName: string | null;
    customerDisplayName: string | null;
    internalEntityDisplayName: string | null;
  };
  timeline: ApiDealTimelineEvent[];
  transitionReadiness: ApiDealTransitionReadiness[];
  workflow: ApiDealWorkflowProjection;
};

export type ApiCrmDealBoardProjection = {
  counts: {
    active: number;
    documents: number;
    drafts: number;
    execution_blocked: number;
    pricing: number;
  };
  items: Array<{
    applicantName: string | null;
    assigneeUserId: string | null;
    blockingReasons: string[];
    customerName: string | null;
    documentSummary: {
      attachmentCount: number;
      formalDocumentCount: number;
    };
    id: string;
    nextAction: string;
    quoteSummary: {
      expiresAt: string | null;
      quoteId: string | null;
      status: string | null;
    } | null;
    stage: "active" | "documents" | "drafts" | "execution_blocked" | "pricing";
    status: DealStatus;
    type: DealType;
    updatedAt: string;
  }>;
};
