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

export type ApiDealLegOperationRef = {
  kind: string;
  operationId: string;
  sourceRef: string;
};

export type ApiDealWorkflowLeg = {
  id: string | null;
  idx: number;
  kind: DealLegKind;
  operationRefs: ApiDealLegOperationRef[];
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
    | "leg_state_changed"
    | "execution_requested"
    | "leg_operation_created"
    | "instruction_prepared"
    | "instruction_submitted"
    | "instruction_settled"
    | "instruction_failed"
    | "instruction_retried"
    | "instruction_voided"
    | "return_requested"
    | "instruction_returned"
    | "deal_closed"
    | "quote_created"
    | "quote_accepted"
    | "quote_expired"
    | "quote_used"
    | "calculation_attached"
    | "attachment_uploaded"
    | "attachment_deleted"
    | "attachment_ingested"
    | "attachment_ingestion_failed"
    | "document_created"
    | "document_status_changed";
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
  revocationReason: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  usedDocumentId: string | null;
} | null;

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
  positions: ApiDealOperationalPosition[];
};

export type ApiDealCounterpartySnapshot = {
  country: string | null;
  displayName: string | null;
  inn: string | null;
  legalName: string | null;
};

export type ApiDealBankInstructionSnapshot = {
  accountNo: string | null;
  bankAddress: string | null;
  bankCountry: string | null;
  bankName: string | null;
  beneficiaryName: string | null;
  bic: string | null;
  iban: string | null;
  label: string | null;
  swift: string | null;
};

export type ApiDealAttachmentIngestion = {
  appliedFields: string[];
  appliedRevision: number | null;
  attempts: number;
  availableAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  fileAssetId: string;
  lastProcessedAt: string | null;
  normalizedPayload: {
    amount: string | null;
    bankInstructionSnapshot: ApiDealBankInstructionSnapshot | null;
    beneficiarySnapshot: ApiDealCounterpartySnapshot | null;
    contractNumber: string | null;
    currencyCode: string | null;
    currencyId: string | null;
    documentPurpose: "invoice" | "contract" | "other" | null;
    invoiceNumber: string | null;
    paymentPurpose: string | null;
  } | null;
  observedRevision: number;
  skippedFields: string[];
  status: "pending" | "processing" | "processed" | "failed";
  updatedAt: string;
};

export type ApiDealWorkflowProjection = {
  acceptedQuote: ApiDealAcceptedQuote;
  attachmentIngestions: ApiDealAttachmentIngestion[];
  executionPlan: ApiDealWorkflowLeg[];
  intake: {
    common: {
      applicantCounterpartyId: string | null;
      customerNote: string | null;
      requestedExecutionDate: string | null;
    };
    externalBeneficiary: {
      bankInstructionSnapshot: ApiDealBankInstructionSnapshot | null;
      beneficiaryCounterpartyId: string | null;
      beneficiarySnapshot: ApiDealCounterpartySnapshot | null;
    };
    incomingReceipt: {
      contractNumber: string | null;
      expectedAmount: string | null;
      expectedAt: string | null;
      invoiceNumber: string | null;
      payerCounterpartyId: string | null;
      payerSnapshot: ApiDealCounterpartySnapshot | null;
    };
    moneyRequest: {
      purpose: string | null;
      sourceAmount: string | null;
      sourceCurrencyId: string | null;
      targetCurrencyId: string | null;
    };
    settlementDestination: {
      bankInstructionSnapshot: ApiDealBankInstructionSnapshot | null;
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
  amount: string | null;
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
  currencyId: string | null;
  createdAt: string;
  customerId: string;
  id: string;
  intakeComment: string | null;
  participants: ApiDealParticipant[];
  reason: string | null;
  status: DealStatus;
  statusHistory: ApiDealStatusHistory[];
  type: DealType;
  updatedAt: string;
};

export type ApiCalculationDetails = {
  createdAt: string;
  currentSnapshot: {
    agreementFeeAmountMinor: string;
    agreementFeeBps: string;
    agreementVersionId: string | null;
    additionalExpensesAmountMinor: string;
    additionalExpensesCurrencyId: string | null;
    additionalExpensesInBaseMinor: string;
    baseCurrencyId: string;
    calculationCurrencyId: string;
    calculationTimestamp: string;
    fixedFeeAmountMinor: string;
    fixedFeeCurrencyId: string | null;
    quoteMarkupAmountMinor: string;
    quoteMarkupBps: string;
    rateDen: string;
    rateNum: string;
    originalAmountMinor: string;
    totalFeeAmountInBaseMinor: string;
    totalFeeAmountMinor: string;
    totalFeeBps: string;
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

export type ApiCustomerCounterparty = {
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
  name: string;
  externalRef: string | null;
  id: string;
  counterparties: ApiCustomerCounterparty[];
};

export type ApiCanonicalCounterparty = {
  externalRef: string | null;
  fullName: string;
  id: string;
  partyProfile: {
    contacts: {
      isPrimary: boolean;
      type: string;
      value: string;
    }[];
    identifiers: Array<{
      scheme: string;
      value: string;
    }>;
    representatives: Array<{
      basisDocument: string | null;
      fullName: string;
      isPrimary: boolean;
      role: string;
      title: string | null;
    }>;
  } | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
};

export type ApiDealCustomerContext = {
  counterparties: ApiCanonicalCounterparty[];
  customer: {
    description: string | null;
    name: string;
    externalRef: string | null;
    id: string;
  };
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
  purpose: "invoice" | "contract" | "other" | null;
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
  fxQuoteId: string | null;
  originalAmountMinor: string;
  rateDen: string;
  rateNum: string;
  sourceQuoteId: string | null;
  totalFeeAmountMinor: string;
  totalAmountMinor: string;
  totalInBaseMinor: string;
  totalWithExpensesInBaseMinor: string;
};

export type ApiQuoteCommercialTerms = {
  agreementFeeBps: string;
  agreementVersionId: string | null;
  fixedFeeAmountMinor: string | null;
  fixedFeeCurrency: string | null;
  quoteMarkupBps: string;
  totalFeeBps: string;
};

export type ApiDealPricingRateSnapshot = {
  asOf: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateDen: string;
  rateNum: string;
  sourceKind: "market" | "route" | "client" | "cost";
  sourceLabel: string | null;
};

export type ApiDealPricingBenchmarks = {
  client: ApiDealPricingRateSnapshot;
  cost: ApiDealPricingRateSnapshot | null;
  market: ApiDealPricingRateSnapshot;
  pricingBase: "route_benchmark" | "market_benchmark";
  routeBase: ApiDealPricingRateSnapshot | null;
};

export type ApiDealPricingProfitability = {
  commercialRevenueMinor: string;
  costPriceMinor: string;
  currency: string;
  customerPrincipalMinor: string;
  customerTotalMinor: string;
  passThroughMinor: string;
  profitMinor: string;
  profitPercentOnCost: string;
};

export type ApiDealPricingFormulaLine = {
  currency: string | null;
  expression: string;
  kind: "equation" | "note";
  label: string;
  metadata: Record<string, unknown>;
  result: string;
};

export type ApiDealPricingFormulaSection = {
  kind: "client_pricing" | "route_execution" | "funding";
  lines: ApiDealPricingFormulaLine[];
  title: string;
};

export type ApiDealPricingFormulaTrace = {
  sections: ApiDealPricingFormulaSection[];
};

export type ApiDealPricingQuote = {
  benchmarks?: ApiDealPricingBenchmarks | null;
  commercialTerms: ApiQuoteCommercialTerms | null;
  createdAt: string;
  dealDirection: string | null;
  dealForm: string | null;
  dealId: string | null;
  expiresAt: string;
  formulaTrace?: ApiDealPricingFormulaTrace | null;
  fromAmountMinor: string;
  fromCurrency: string;
  fromCurrencyId: string;
  id: string;
  idempotencyKey: string;
  pricingFingerprint: string | null;
  pricingMode: string;
  pricingTrace: Record<string, unknown>;
  profitability?: ApiDealPricingProfitability | null;
  rateDen: string;
  rateNum: string;
  status: string;
  toAmountMinor: string;
  toCurrency: string;
  toCurrencyId: string;
  usedAt: string | null;
  usedByRef: string | null;
  usedDocumentId: string | null;
};

export type ApiQuotePreview = {
  commercialTerms: ApiQuoteCommercialTerms | null;
  dealDirection: string | null;
  dealForm: string | null;
  expiresAt: string;
  feeComponents: {
    amountMinor: string;
    currency: string;
    kind: string;
    metadata: Record<string, unknown>;
    memo?: string;
    source: string;
  }[];
  financialLines: {
    amountMinor: string;
    bucket:
      | "adjustment"
      | "provider_payable"
      | "provider_fee_expense"
      | "provider_receivable"
      | "customer_payable"
      | "customer_receivable"
      | "fee_revenue"
      | "spread_revenue"
      | "pass_through";
    currency: string;
    memo?: string;
    metadata: Record<string, unknown>;
    settlementMode?: "in_ledger" | "separate_payment_order";
    source: string;
  }[];
  fromAmount: string;
  fromAmountMinor: string;
  fromCurrency: string;
  legs: {
    asOf: string;
    executionCounterpartyId: string | null;
    fromAmountMinor: string;
    fromCurrency: string;
    idx: number;
    rateDen: string;
    rateNum: string;
    sourceKind: string;
    sourceRef: string | null;
    toAmountMinor: string;
    toCurrency: string;
  }[];
  pricingMode: string;
  pricingTrace: Record<string, unknown>;
  rateDen: string;
  rateNum: string;
  toAmount: string;
  toAmountMinor: string;
  toCurrency: string;
};

export type ApiDealFundingAdjustment = {
  amountMinor: string;
  currencyId: string;
  id: string;
  kind:
    | "available_balance"
    | "reconciliation_adjustment"
    | "already_funded"
    | "manual_offset";
  label: string;
};

export type ApiDealPricingCommercialDraft = {
  fixedFeeAmount: string | null;
  fixedFeeCurrency: string | null;
  quoteMarkupBps: number | null;
};

export type ApiPaymentRouteFee = {
  amountMinor?: string;
  chargeToCustomer: boolean;
  currencyId?: string | null;
  id: string;
  kind: "fixed" | "fx_spread" | "gross_percent" | "net_percent";
  label?: string;
  percentage?: string;
};

export type ApiPaymentRouteDraft = {
  additionalFees: ApiPaymentRouteFee[];
  amountInMinor: string;
  amountOutMinor: string;
  currencyInId: string;
  currencyOutId: string;
  legs: Array<{
    feeIds?: string[];
    fees?: ApiPaymentRouteFee[];
    id: string;
    fromCurrencyId: string;
    idx: number;
    ratePairId?: string | null;
    rateSide?: "inverse" | "normal";
    rateSourceKind?: string;
    toCurrencyId: string;
  }>;
  lockedSide: "currency_in" | "currency_out";
  participants: Array<{
    binding: "abstract" | "bound";
    displayName: string;
    entityId: string | null;
    entityKind: "customer" | "counterparty" | "organization" | null;
    nodeId: string;
    requisiteId: string | null;
    role: "source" | "hop" | "destination";
  }>;
};

export type ApiDealPricingRouteAttachment = {
  attachedAt: string;
  snapshot: ApiPaymentRouteDraft;
  templateId: string;
  templateName: string;
};

export type ApiDealPricingContext = {
  commercialDraft: ApiDealPricingCommercialDraft;
  fundingAdjustments: ApiDealFundingAdjustment[];
  revision: number;
  routeAttachment: ApiDealPricingRouteAttachment | null;
};

export type ApiPaymentRouteCalculation = {
  additionalFees: Array<{
    amountMinor: string;
    chargeToCustomer: boolean;
    currencyId: string;
    id: string;
    inputImpactCurrencyId: string;
    inputImpactMinor: string;
    label?: string;
    outputImpactCurrencyId: string;
    outputImpactMinor: string;
    routeInputImpactMinor: string;
    kind: "fixed" | "fx_spread" | "gross_percent" | "net_percent";
    percentage?: string;
  }>;
  amountInMinor: string;
  amountOutMinor: string;
  chargedFeeTotals: Array<{ amountMinor: string; currencyId: string }>;
  cleanAmountOutMinor: string;
  clientTotalInMinor: string;
  computedAt: string;
  costPriceInMinor: string;
  currencyInId: string;
  currencyOutId: string;
  feeTotals: Array<{ amountMinor: string; currencyId: string }>;
  grossAmountOutMinor: string;
  internalFeeTotals: Array<{ amountMinor: string; currencyId: string }>;
  legs: Array<{
    asOf: string;
    fees: Array<{
      amountMinor: string;
      chargeToCustomer: boolean;
      currencyId: string;
      id: string;
      inputImpactCurrencyId: string;
      inputImpactMinor: string;
      label?: string;
      outputImpactCurrencyId: string;
      outputImpactMinor: string;
      routeInputImpactMinor: string;
      kind: "fixed" | "fx_spread" | "gross_percent" | "net_percent";
      percentage?: string;
    }>;
    fromCurrencyId: string;
    grossOutputMinor: string;
    id: string;
    idx: number;
    inputAmountMinor: string;
    netOutputMinor: string;
    rateDen: string;
    rateNum: string;
    rateSource: string;
    toCurrencyId: string;
  }>;
  lockedSide: "currency_in" | "currency_out";
  netAmountOutMinor: string;
};

export type ApiDealFundingPosition = {
  adjustmentTotalMinor: string;
  currencyCode: string;
  currencyId: string;
  netFundingNeedMinor: string;
  requiredMinor: string;
};

export type ApiDealPricingPreview = {
  benchmarks: ApiDealPricingBenchmarks;
  formulaTrace: ApiDealPricingFormulaTrace;
  fundingSummary: {
    positions: ApiDealFundingPosition[];
  };
  pricingFingerprint: string;
  pricingMode: "auto_cross" | "explicit_route";
  profitability: ApiDealPricingProfitability | null;
  quotePreview: ApiQuotePreview;
  routePreview: ApiPaymentRouteCalculation | null;
};

export type ApiDealPricingQuoteResult = {
  benchmarks: ApiDealPricingBenchmarks;
  formulaTrace: ApiDealPricingFormulaTrace;
  pricingMode: "auto_cross" | "explicit_route";
  profitability: ApiDealPricingProfitability | null;
  quote: ApiDealPricingQuote;
};

export type ApiDealQuoteAcceptanceHistoryItem = {
  acceptanceId: string;
  acceptedAt: string;
  acceptedByUserId: string;
  commercialRevenueMinor: string | null;
  customerTotalMinor: string | null;
  expiresAt: string | null;
  fromAmountMinor: string;
  fromCurrency: string;
  pricingFingerprint: string | null;
  quoteId: string;
  rateDen: string;
  rateNum: string;
  replacedByQuoteId: string | null;
  revokedAt: string | null;
  toAmountMinor: string;
  toCurrency: string;
};

export type ApiDealPricingRouteCandidate = {
  createdAt: string;
  currencyInId: string;
  currencyOutId: string;
  destinationEndpoint: {
    binding: "abstract" | "bound";
    displayName: string;
    entityId: string | null;
    entityKind: "customer" | "counterparty" | "organization" | null;
    nodeId: string;
    requisiteId: string | null;
    role: "source" | "hop" | "destination";
  };
  hopCount: number;
  id: string;
  lastCalculation: ApiPaymentRouteCalculation | null;
  name: string;
  snapshotPolicy: string;
  sourceEndpoint: {
    binding: "abstract" | "bound";
    displayName: string;
    entityId: string | null;
    entityKind: "customer" | "counterparty" | "organization" | null;
    nodeId: string;
    requisiteId: string | null;
    role: "source" | "hop" | "destination";
  };
  status: string;
  updatedAt: string;
};

export type CalculationView = {
  additionalExpenses: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesInBase: string;
  agreementFeeAmount: string;
  agreementFeePercentage: string;
  baseCurrencyCode: string;
  currencyCode: string;
  finalRate: string;
  fixedFeeAmount: string;
  fixedFeeCurrencyCode: string | null;
  originalAmount: string;
  quoteMarkupAmount: string;
  quoteMarkupPercentage: string;
  totalFeeAmount: string;
  totalFeeAmountInBase: string;
  totalFeePercentage: string;
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
  partyProfile: ApiCustomerCounterparty | null;
  organization: ApiOrganization;
  organizationRequisite: ApiRequisite;
  organizationRequisiteProvider: ApiRequisiteProvider | null;
  currency: ApiCurrency | null;
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
  beneficiaryDraft: {
    bankInstructionSnapshot: ApiDealBankInstructionSnapshot | null;
    beneficiarySnapshot: ApiDealCounterpartySnapshot | null;
    fieldPresence: {
      bankInstructionFields: number;
      beneficiaryFields: number;
    };
    purpose: "invoice" | "contract" | "other" | null;
    sourceAttachmentId: string;
  } | null;
  comment: string | null;
  context: {
    agreement: ApiAgreementDetails | null;
    applicant: ApiCanonicalCounterparty | null;
    customer: ApiDealCustomerContext | null;
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
    context: ApiDealPricingContext;
    currentCalculation: ApiCalculationDetails | null;
    quoteEligibility: boolean;
    quotes: ApiDealPricingQuote[];
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
