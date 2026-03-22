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
