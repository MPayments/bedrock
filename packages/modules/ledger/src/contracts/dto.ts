import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Dimensions } from "../domain/dimensions";

export type LedgerOperationStatus = "pending" | "posted" | "failed";
export type TbPlanStatus = "pending" | "posted" | "failed";
export type TbPlanType = "create" | "post_pending" | "void_pending";

export interface LedgerOperationListRow {
  id: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  operationVersion: number;
  postingDate: Date;
  status: LedgerOperationStatus;
  error: string | null;
  postedAt: Date | null;
  outboxAttempts: number;
  lastOutboxErrorAt: Date | null;
  createdAt: Date;
  postingCount: number;
  bookIds: string[];
  currencies: string[];
}

export interface LedgerOperationPostingRow {
  id: string;
  lineNo: number;
  bookId: string;
  bookName: string | null;
  debitInstanceId: string;
  debitAccountNo: string | null;
  debitDimensions: Dimensions | null;
  creditInstanceId: string;
  creditAccountNo: string | null;
  creditDimensions: Dimensions | null;
  postingCode: string;
  currency: string;
  amountMinor: bigint;
  memo: string | null;
  context: Record<string, string> | null;
  createdAt: Date;
}

export interface LedgerOperationTbPlanRow {
  id: string;
  lineNo: number;
  type: TbPlanType;
  transferId: bigint;
  debitTbAccountId: bigint | null;
  creditTbAccountId: bigint | null;
  tbLedger: number;
  amount: bigint;
  code: number;
  pendingRef: string | null;
  pendingId: bigint | null;
  isLinked: boolean;
  isPending: boolean;
  timeoutSeconds: number;
  status: TbPlanStatus;
  error: string | null;
  createdAt: Date;
}

export interface LedgerOperationDetails {
  operation: LedgerOperationListRow;
  postings: LedgerOperationPostingRow[];
  tbPlans: LedgerOperationTbPlanRow[];
}

export type LedgerOperationList = PaginatedList<LedgerOperationListRow>;

export interface LedgerBookRow {
  id: string;
  name: string | null;
  ownerId: string | null;
}

export interface AccountingScopedPostingRow {
  operationId: string;
  sourceType: string;
  sourceId: string;
  lineNo: number;
  postingDate: Date;
  status: LedgerOperationStatus;
  bookId: string;
  bookLabel: string | null;
  bookCounterpartyId: string | null;
  currency: string;
  amountMinor: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  analyticCounterpartyId: string | null;
}
