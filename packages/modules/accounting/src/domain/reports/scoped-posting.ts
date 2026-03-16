import type { FinancialResultStatus } from "./financial-result-status";

export interface ScopedPosting {
  operationId: string;
  lineNo: number;
  postingDate: Date;
  status: FinancialResultStatus;
  bookId: string;
  bookLabel: string | null;
  bookCounterpartyId: string | null;
  currency: string;
  amountMinor: bigint;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  analyticCounterpartyId: string | null;
  documentId: string | null;
  documentType: string | null;
  channel: string | null;
}
