import type {
  DealApprovalStatus,
  DealApprovalType,
  DealLegKind,
  DealParticipantRole,
  DealStatus,
  DealType,
} from "../contracts/zod";

export interface CreateDealRootInput {
  id: string;
  customerId: string;
  agreementId: string;
  calculationId: string | null;
  type: DealType;
  status?: DealStatus;
  agentId: string | null;
  reason: string | null;
  intakeComment: string | null;
  comment: string | null;
  requestedAmountMinor: bigint | null;
  requestedCurrencyId: string | null;
}

export interface CreateDealLegStoredInput {
  id: string;
  dealId: string;
  idx: number;
  kind: DealLegKind;
  status: DealStatus;
}

export interface CreateDealParticipantStoredInput {
  id: string;
  dealId: string;
  role: DealParticipantRole;
  customerId: string | null;
  organizationId: string | null;
  counterpartyId: string | null;
}

export interface CreateDealStatusHistoryStoredInput {
  id: string;
  dealId: string;
  status: DealStatus;
  changedBy: string | null;
  comment: string | null;
}

export interface CreateDealApprovalStoredInput {
  id: string;
  dealId: string;
  approvalType: DealApprovalType;
  status: DealApprovalStatus;
  requestedBy: string | null;
  decidedBy: string | null;
  comment: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}

export interface DealStore {
  createDealCalculationLinks(
    input: { id: string; calculationId: string; dealId: string }[],
  ): Promise<void>;
  createDealRoot(input: CreateDealRootInput): Promise<void>;
  createDealLegs(input: CreateDealLegStoredInput[]): Promise<void>;
  createDealParticipants(input: CreateDealParticipantStoredInput[]): Promise<void>;
  createDealStatusHistory(
    input: CreateDealStatusHistoryStoredInput[],
  ): Promise<void>;
  createDealApprovals(input: CreateDealApprovalStoredInput[]): Promise<void>;
  setCounterpartyParticipant(input: {
    counterpartyId: string | null;
    dealId: string;
    id?: string;
  }): Promise<void>;
  updateDealRoot(input: {
    dealId: string;
    agentId?: string | null;
    calculationId?: string | null;
    comment?: string | null;
    intakeComment?: string | null;
    reason?: string | null;
    requestedAmountMinor?: bigint | null;
    requestedCurrencyId?: string | null;
    status?: DealStatus;
  }): Promise<void>;
}
