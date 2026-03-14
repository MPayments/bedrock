export interface CorrespondenceRuleRecord {
  id: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
