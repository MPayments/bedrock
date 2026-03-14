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

export interface ChartAccountDimensionPolicyRecord {
  accountNo: string;
  dimensionKey: string;
  mode: "required" | "optional" | "forbidden";
  createdAt: Date;
}

export interface PostingCodeDimensionPolicyRecord {
  postingCode: string;
  dimensionKey: string;
  required: boolean;
  scope: "line" | "debit" | "credit";
  createdAt: Date;
}

export interface CorrespondenceRuleRecord {
  id: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
