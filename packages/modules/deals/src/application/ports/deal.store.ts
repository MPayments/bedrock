import type { DealIntakeDraft } from "../contracts/dto";
import type {
  DealApprovalStatus,
  DealApprovalType,
  DealLegKind,
  DealLegState,
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

export interface CreateDealLegStoredInput {
  dealId: string;
  id: string;
  idx: number;
  kind: DealLegKind;
  state: DealLegState;
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
  createDealApprovals(input: CreateDealApprovalStoredInput[]): Promise<void>;
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
  createDealQuoteAcceptance(
    input: CreateDealQuoteAcceptanceStoredInput,
  ): Promise<void>;
  createDealRoot(input: CreateDealRootInput): Promise<void>;
  createDealTimelineEvents(
    input: CreateDealTimelineEventStoredInput[],
  ): Promise<void>;
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
  setDealRoot(input: {
    agentId?: string | null;
    calculationId?: string | null;
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
}
