export interface ChartTemplateAccountRecord {
  accountNo: string;
  name: string;
  kind: "asset" | "liability" | "equity" | "revenue" | "expense" | "active_passive";
  normalSide: "debit" | "credit" | "both";
  postingAllowed: boolean;
  enabled: boolean;
  parentAccountNo: string | null;
  createdAt: Date;
}
