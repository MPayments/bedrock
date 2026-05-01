import type { PaymentRouteDraft } from "@bedrock/treasury/model";

import type {
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_ATTACHMENT_INGESTION_STATUS_VALUES,
  DEAL_LEG_KIND_VALUES,
  DEAL_LEG_OPERATION_KIND_VALUES,
  DEAL_LEG_STATE_VALUES,
  DEAL_LEGACY_PARTICIPANT_ROLE_VALUES,
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
  DEAL_PARTICIPANT_ROLE_VALUES,
  DEAL_SECTION_ID_VALUES,
  DEAL_STATUS_VALUES,
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
  DEAL_TIMELINE_VISIBILITY_VALUES,
  DEAL_TRANSITION_BLOCKER_CODE_VALUES,
  DEAL_TYPE_VALUES,
} from "./constants";

export type DealType = (typeof DEAL_TYPE_VALUES)[number];
export type DealStatus = (typeof DEAL_STATUS_VALUES)[number];
export type DealLegKind = (typeof DEAL_LEG_KIND_VALUES)[number];
export type DealLegState = (typeof DEAL_LEG_STATE_VALUES)[number];
export type DealLegOperationKind =
  (typeof DEAL_LEG_OPERATION_KIND_VALUES)[number];
export type DealAttachmentIngestionStatus =
  (typeof DEAL_ATTACHMENT_INGESTION_STATUS_VALUES)[number];
export type DealOperationalPositionKind =
  (typeof DEAL_OPERATIONAL_POSITION_KIND_VALUES)[number];
export type DealOperationalPositionState =
  (typeof DEAL_OPERATIONAL_POSITION_STATE_VALUES)[number];
export type DealParticipantRole =
  (typeof DEAL_PARTICIPANT_ROLE_VALUES)[number];
export type LegacyDealParticipantRole =
  (typeof DEAL_LEGACY_PARTICIPANT_ROLE_VALUES)[number];
export type DealSectionId = (typeof DEAL_SECTION_ID_VALUES)[number];
export type DealTimelineEventType =
  (typeof DEAL_TIMELINE_EVENT_TYPE_VALUES)[number];
export type DealTimelineVisibility =
  (typeof DEAL_TIMELINE_VISIBILITY_VALUES)[number];
export type DealApprovalType = (typeof DEAL_APPROVAL_TYPE_VALUES)[number];
export type DealApprovalStatus = (typeof DEAL_APPROVAL_STATUS_VALUES)[number];
export type DealTransitionBlockerCode =
  (typeof DEAL_TRANSITION_BLOCKER_CODE_VALUES)[number];

export interface DealCounterpartySnapshot {
  country: string | null;
  displayName: string | null;
  inn: string | null;
  legalName: string | null;
}

export interface DealBankInstructionSnapshot {
  accountNo: string | null;
  bankAddress: string | null;
  bankCountry: string | null;
  bankName: string | null;
  beneficiaryName: string | null;
  bic: string | null;
  iban: string | null;
  label: string | null;
  swift: string | null;
}

export interface DealCommonIntakeSection {
  applicantCounterpartyId: string | null;
  customerNote: string | null;
  requestedExecutionDate: Date | null;
}

export interface DealMoneyRequestIntakeSection {
  purpose: string | null;
  sourceAmount: string | null;
  sourceCurrencyId: string | null;
  targetCurrencyId: string | null;
}

export interface DealIncomingReceiptIntakeSection {
  contractNumber: string | null;
  expectedAmount: string | null;
  expectedAt: Date | null;
  invoiceNumber: string | null;
  payerCounterpartyId: string | null;
  payerSnapshot: DealCounterpartySnapshot | null;
}

export interface DealExternalBeneficiaryIntakeSection {
  beneficiaryCounterpartyId: string | null;
  beneficiarySnapshot: DealCounterpartySnapshot | null;
  bankInstructionSnapshot: DealBankInstructionSnapshot | null;
}

export type DealSettlementDestinationMode = "applicant_requisite" | "manual";

export interface DealSettlementDestinationIntakeSection {
  bankInstructionSnapshot: DealBankInstructionSnapshot | null;
  mode: DealSettlementDestinationMode | null;
  requisiteId: string | null;
}

interface DealIntakeBase {
  common: DealCommonIntakeSection;
  externalBeneficiary: DealExternalBeneficiaryIntakeSection;
  incomingReceipt: DealIncomingReceiptIntakeSection;
  moneyRequest: DealMoneyRequestIntakeSection;
  settlementDestination: DealSettlementDestinationIntakeSection;
}

export type DealIntakeDraft =
  | (DealIntakeBase & { type: "payment" })
  | (DealIntakeBase & { type: "currency_exchange" })
  | (DealIntakeBase & { type: "currency_transit" })
  | (DealIntakeBase & { type: "exporter_settlement" });

export interface DealLegOperationRef {
  kind: DealLegOperationKind;
  operationId: string;
  sourceRef: string;
}

export interface DealWorkflowLeg {
  fromCurrencyId: string | null;
  id: string | null;
  idx: number;
  kind: DealLegKind;
  operationRefs: DealLegOperationRef[];
  routeSnapshotLegId: string | null;
  state: DealLegState;
  toCurrencyId: string | null;
}

export interface DealWorkflowParticipant {
  counterpartyId: string | null;
  customerId: string | null;
  displayName: string | null;
  id: string;
  organizationId: string | null;
  role: DealParticipantRole;
}

export interface DealSectionCompleteness {
  blockingReasons: string[];
  complete: boolean;
  sectionId: DealSectionId;
}

export interface DealTimelineEvent {
  actor: { label: string | null; userId: string | null } | null;
  id: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  type: DealTimelineEventType;
  visibility: DealTimelineVisibility;
}

export interface DealTransitionBlocker {
  code: DealTransitionBlockerCode;
  message: string;
  meta?: Record<string, unknown>;
}

export interface DealTransitionReadiness {
  allowed: boolean;
  blockers: DealTransitionBlocker[];
  targetStatus: DealStatus;
}

export type DealFundingResolutionState =
  | "not_applicable"
  | "blocked"
  | "resolved";
export type DealFundingStrategy = "existing_inventory" | "external_fx";

export interface DealFundingResolution {
  availableMinor: string | null;
  fundingOrganizationId: string | null;
  fundingRequisiteId: string | null;
  reasonCode: string | null;
  requiredAmountMinor: string | null;
  state: DealFundingResolutionState;
  strategy: DealFundingStrategy | null;
  targetCurrency: string | null;
  targetCurrencyId: string | null;
}

export interface DealRelatedFormalDocument {
  approvalStatus: string | null;
  createdAt: Date | null;
  docType: string;
  id: string;
  invoicePurpose?: string | null;
  lifecycleStatus: string | null;
  occurredAt: Date | null;
  postingStatus: string | null;
  submissionStatus: string | null;
}

export interface DealApproval {
  approvalType: DealApprovalType;
  comment: string | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  id: string;
  requestedAt: Date;
  requestedBy: string | null;
  status: DealApprovalStatus;
}

export interface DealQuoteAcceptance {
  acceptedAt: Date;
  acceptedByUserId: string;
  agreementVersionId: string | null;
  dealId: string;
  dealRevision: number;
  expiresAt: Date | null;
  id: string;
  quoteId: string;
  quoteStatus: string;
  replacedByQuoteId: string | null;
  revocationReason: string | null;
  revokedAt: Date | null;
  usedAt: Date | null;
  usedDocumentId: string | null;
}

export interface DealOperationalPosition {
  amountMinor: string | null;
  currencyId: string | null;
  kind: DealOperationalPositionKind;
  reasonCode: string | null;
  sourceRefs: string[];
  state: DealOperationalPositionState;
  updatedAt: Date | null;
}

export interface DealOperationalState {
  positions: DealOperationalPosition[];
}

export type DealPricingRouteSnapshot = PaymentRouteDraft;
