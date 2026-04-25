import type {
  DealIntakeDraft,
  DealPricingContextSnapshot,
} from "../contracts/dto";
import type {
  DealAttachmentIngestionStatus,
  DealApprovalStatus,
  DealApprovalType,
  DealLegKind,
  DealParticipantRole,
  DealStatus,
  DealTimelineEventType,
  DealTimelineVisibility,
  DealType,
} from "../contracts/zod";

export interface CreateDealRootInput {
  agreementId: string;
  agentId: string | null;
  calculationId: string | null;
  customerId: string;
  id: string;
  nextAction: string | null;
  sourceAmountMinor: bigint | null;
  sourceCurrencyId: string | null;
  status?: DealStatus;
  targetCurrencyId: string | null;
  type: DealType;
}

export interface CreateDealIntakeSnapshotStoredInput {
  dealId: string;
  revision: number;
  snapshot: DealIntakeDraft;
}

export interface CreateDealPricingContextStoredInput {
  dealId: string;
  revision: number;
  snapshot: DealPricingContextSnapshot;
}

export interface CreateDealLegStoredInput {
  dealId: string;
  fromCurrencyId: string | null;
  id: string;
  idx: number;
  kind: DealLegKind;
  routeSnapshotLegId: string | null;
  toCurrencyId: string | null;
}

export interface CreateDealParticipantStoredInput {
  counterpartyId: string | null;
  customerId: string | null;
  dealId: string;
  id: string;
  organizationId: string | null;
  role: DealParticipantRole;
}

export interface CreateDealTimelineEventStoredInput {
  actorLabel: string | null;
  actorUserId: string | null;
  dealId: string;
  id: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  sourceRef: string | null;
  type: DealTimelineEventType;
  visibility: DealTimelineVisibility;
}

export interface CreateDealAttachmentIngestionStoredInput {
  appliedFields: string[];
  appliedRevision: number | null;
  attempts: number;
  availableAt: Date;
  dealId: string;
  errorCode: string | null;
  errorMessage: string | null;
  fileAssetId: string;
  id: string;
  lastProcessedAt: Date | null;
  normalizedPayload: Record<string, unknown> | null;
  observedRevision: number;
  skippedFields: string[];
  status: DealAttachmentIngestionStatus;
}

export interface CreateDealQuoteAcceptanceStoredInput {
  acceptedAt: Date;
  acceptedByUserId: string;
  agreementVersionId: string | null;
  dealId: string;
  dealRevision: number;
  id: string;
  quoteId: string;
}

export interface CreateDealApprovalStoredInput {
  approvalType: DealApprovalType;
  comment: string | null;
  dealId: string;
  decidedAt: Date | null;
  decidedBy: string | null;
  id: string;
  requestedAt: Date;
  requestedBy: string | null;
  status: DealApprovalStatus;
}

export interface DealStore {
  claimAttachmentIngestions(input: {
    batchSize: number;
    leaseSeconds: number;
    now: Date;
  }): Promise<
    {
      attempts: number;
      availableAt: Date;
      dealId: string;
      fileAssetId: string;
      observedRevision: number;
      status: DealAttachmentIngestionStatus;
    }[]
  >;
  createDealApprovals(input: CreateDealApprovalStoredInput[]): Promise<void>;
  createDealAttachmentIngestion(
    input: CreateDealAttachmentIngestionStoredInput,
  ): Promise<void>;
  createDealCalculationLinks(
    input: {
      calculationId: string;
      dealId: string;
      id: string;
      sourceQuoteId?: string | null;
    }[],
  ): Promise<void>;
  createDealIntakeSnapshot(
    input: CreateDealIntakeSnapshotStoredInput,
  ): Promise<void>;
  createDealPricingContext(
    input: CreateDealPricingContextStoredInput,
  ): Promise<void>;
  createDealQuoteAcceptance(
    input: CreateDealQuoteAcceptanceStoredInput,
  ): Promise<void>;
  createDealRoot(input: CreateDealRootInput): Promise<void>;
  createDealTimelineEvents(
    input: CreateDealTimelineEventStoredInput[],
  ): Promise<void>;
  setDealAttachmentIngestion(input: {
    appliedFields?: string[];
    appliedRevision?: number | null;
    availableAt?: Date;
    errorCode?: string | null;
    errorMessage?: string | null;
    fileAssetId: string;
    lastProcessedAt?: Date | null;
    normalizedPayload?: Record<string, unknown> | null;
    skippedFields?: string[];
    status?: DealAttachmentIngestionStatus;
  }): Promise<void>;
  replaceDealLegs(input: {
    dealId: string;
    legs: CreateDealLegStoredInput[];
  }): Promise<void>;
  replaceDealParticipants(input: {
    dealId: string;
    participants: CreateDealParticipantStoredInput[];
  }): Promise<void>;
  replaceIntakeSnapshot(input: {
    dealId: string;
    expectedRevision: number;
    nextRevision: number;
    snapshot: DealIntakeDraft;
  }): Promise<boolean>;
  replaceDealPricingContext(input: {
    dealId: string;
    expectedRevision: number;
    nextRevision: number;
    snapshot: DealPricingContextSnapshot;
  }): Promise<boolean>;
  setDealRoot(input: {
    agreementId?: string;
    agentId?: string | null;
    calculationId?: string | null;
    comment?: string | null;
    dealId: string;
    nextAction?: string | null;
    sourceAmountMinor?: bigint | null;
    sourceCurrencyId?: string | null;
    status?: DealStatus;
    targetCurrencyId?: string | null;
  }): Promise<void>;
  supersedeCurrentQuoteAcceptances(input: {
    dealId: string;
    replacedByQuoteId: string;
    revokedAt: Date;
  }): Promise<void>;
  revokeCurrentQuoteAcceptances(input: {
    dealId: string;
    revocationReason: string;
    revokedAt: Date;
  }): Promise<boolean>;
  upsertDealAttachmentIngestion(input: {
    availableAt: Date;
    dealId: string;
    fileAssetId: string;
    id: string;
    observedRevision: number;
  }): Promise<void>;
  setDealLegManualOverride(input: {
    dealId: string;
    idx: number;
    manualOverrideState: "blocked" | "skipped" | null;
    reasonCode: string | null;
    comment: string | null;
  }): Promise<boolean>;
}
