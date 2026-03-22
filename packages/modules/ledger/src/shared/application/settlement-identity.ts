export interface SettlementIdentityPolicy {
  settlementIdForOperationLine: (input: {
    operationId: string;
    lineNo: number;
    planRef: string;
  }) => bigint;
  settlementLedgerForCurrency: (input: { currency: string }) => number;
}
