import { z } from "zod";

import accountingDefaultsRaw from "./assets/defaults.json" with { type: "json" };
import accountingReportLineMappingsRaw from "./assets/report-line-mappings.json" with { type: "json" };

const CHART_ACCOUNT_KIND_VALUES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "active_passive",
] as const;
const CHART_NORMAL_SIDE_VALUES = ["debit", "credit", "both"] as const;
const DIMENSION_MODE_VALUES = ["required", "optional", "forbidden"] as const;
const DIMENSION_POLICY_SCOPE_VALUES = ["line", "debit", "credit"] as const;
const REPORT_KIND_VALUES = [
  "balance_sheet",
  "income_statement",
  "cash_flow_direct",
  "cash_flow_indirect",
  "fx_revaluation",
  "fee_revenue",
] as const;
const ACCOUNT_NO_REGEX = /^[0-9]{4}$/;

export const ACCOUNT_NO = {
  ASSETS: "1000",
  CASH_AND_EQUIVALENTS: "1100",
  OPERATING_ASSETS: "1200",
  CLEARING_GROUP: "1300",
  LIABILITIES: "2000",
  OPERATING_LIABILITIES: "2100",
  SHAREHOLDER_LOAN: "2210",
  EQUITY: "3000",
  FOUNDER_EQUITY: "3110",
  INVESTOR_EQUITY: "3120",
  OPENING_BALANCE_EQUITY: "3200",
  REVENUES: "4000",
  EXPENSES: "5000",
  BANK: "1110",
  TRANSIT: "1220",
  CLEARING: "1310",
  CUSTOMER_WALLET: "2110",
  FEE_CLEARING: "2120",
  PAYOUT_OBLIGATION: "2130",
  ORDER_RESERVE: "2140",
  FEE_REVENUE: "4110",
  SPREAD_REVENUE: "4120",
  ADJUSTMENT_REVENUE: "4130",
  ADJUSTMENT_EXPENSE: "5110",
  PROVIDER_FEE_EXPENSE: "5120",
} as const;

export const DIM = {
  organizationRequisiteId: "organizationRequisiteId",
  counterpartyId: "counterpartyId",
  customerId: "customerId",
  orderId: "orderId",
  feeBucket: "feeBucket",
  clearingKind: "clearingKind",
} as const;

export type DimensionKey = (typeof DIM)[keyof typeof DIM];
export type Dimensions = Record<string, string>;
export type DimensionMode = (typeof DIMENSION_MODE_VALUES)[number];
export type DimensionPolicyScope =
  (typeof DIMENSION_POLICY_SCOPE_VALUES)[number];

export interface AccountDimensionPolicy {
  accountNo: string;
  dimensionKey: string;
  mode: DimensionMode;
}

export interface PostingCodeDimensionPolicyEntry {
  postingCode: string;
  dimensionKey: string;
  required: boolean;
  scope: DimensionPolicyScope;
}

export interface ClearingKindDimensionRule {
  dimensionKey: string;
  mode: DimensionMode;
}

export interface AccountingReportLineMappingDefault {
  standard: string;
  reportKind: (typeof REPORT_KIND_VALUES)[number];
  lineCode: string;
  lineLabel: string;
  section: string;
  accountNo: string;
  signMultiplier: number;
}

export const KNOWN_DIMENSION_KEYS = new Set<string>(Object.values(DIM));

export const CLEARING_KIND = {
  INTERCOMPANY: "intercompany",
  TREASURY_FX: "treasury_fx",
} as const;

export const POSTING_CODE = {
  TRANSFER_INTRA_IMMEDIATE: "TR.INTRA.IMMEDIATE",
  TRANSFER_INTRA_PENDING: "TR.INTRA.PENDING",
  TRANSFER_CROSS_SOURCE_IMMEDIATE: "TR.CROSS.SOURCE.IMMEDIATE",
  TRANSFER_CROSS_DEST_IMMEDIATE: "TR.CROSS.DEST.IMMEDIATE",
  TRANSFER_CROSS_SOURCE_PENDING: "TR.CROSS.SOURCE.PENDING",
  TRANSFER_CROSS_DEST_PENDING: "TR.CROSS.DEST.PENDING",
  FUNDING_SETTLED: "TC.1001",
  EXTERNAL_FUNDING_FOUNDER_EQUITY: "TC.9001",
  EXTERNAL_FUNDING_INVESTOR_EQUITY: "TC.9002",
  EXTERNAL_FUNDING_SHAREHOLDER_LOAN: "TC.9003",
  EXTERNAL_FUNDING_OPENING_BALANCE: "TC.9005",
  FX_PRINCIPAL: "TC.2001",
  FX_PAYOUT_OBLIGATION: "TC.2005",
  FX_LEG_OUT: "TC.2009",
  FX_LEG_IN: "TC.2010",
  TREASURY_FX_SOURCE_IMMEDIATE: "TC.2101",
  TREASURY_FX_DESTINATION_IMMEDIATE: "TC.2102",
  TREASURY_FX_SOURCE_PENDING: "TC.2103",
  TREASURY_FX_DESTINATION_PENDING: "TC.2104",
  FEE_INCOME: "TC.3001",
  SPREAD_INCOME: "TC.3002",
  FEE_PASS_THROUGH_RESERVE: "TC.3003",
  FEE_INCOME_FROM_RESERVE: "TC.3004",
  SPREAD_INCOME_FROM_RESERVE: "TC.3005",
  ADJUSTMENT_CHARGE: "TC.3006",
  ADJUSTMENT_REFUND: "TC.3007",
  PROVIDER_FEE_EXPENSE_ACCRUAL: "TC.3008",
  ADJUSTMENT_CHARGE_FROM_RESERVE: "TC.3009",
  ADJUSTMENT_REFUND_FROM_RESERVE: "TC.3010",
  FEE_PAYMENT_INITIATED: "TC.3011",
  TREASURY_FX_FEE_INCOME: "TC.3201",
  TREASURY_FX_SPREAD_INCOME: "TC.3202",
  TREASURY_FX_PASS_THROUGH: "TC.3203",
  TREASURY_FX_PROVIDER_FEE_EXPENSE: "TC.3204",
  TREASURY_FX_ADJUSTMENT_CHARGE: "TC.3205",
  TREASURY_FX_ADJUSTMENT_REFUND: "TC.3206",
  PAYOUT_INITIATED: "TC.3101",
} as const;

export const TransferCodes = {
  FUNDING_SETTLED: 1001,
  FX_PRINCIPAL: 2001,
  FX_PAYOUT_OBLIGATION: 2005,
  FX_LEG_OUT: 2009,
  FX_LEG_IN: 2010,
  TREASURY_FX_SOURCE_IMMEDIATE: 2101,
  TREASURY_FX_DESTINATION_IMMEDIATE: 2102,
  TREASURY_FX_SOURCE_PENDING: 2103,
  TREASURY_FX_DESTINATION_PENDING: 2104,
  FEE_INCOME: 3001,
  SPREAD_INCOME: 3002,
  FEE_PASS_THROUGH_RESERVE: 3003,
  FEE_INCOME_FROM_RESERVE: 3004,
  SPREAD_INCOME_FROM_RESERVE: 3005,
  ADJUSTMENT_CHARGE: 3006,
  ADJUSTMENT_REFUND: 3007,
  PROVIDER_FEE_EXPENSE_ACCRUAL: 3008,
  ADJUSTMENT_CHARGE_FROM_RESERVE: 3009,
  ADJUSTMENT_REFUND_FROM_RESERVE: 3010,
  FEE_PAYMENT_INITIATED: 3011,
  TREASURY_FX_FEE_INCOME: 3201,
  TREASURY_FX_SPREAD_INCOME: 3202,
  TREASURY_FX_PASS_THROUGH: 3203,
  TREASURY_FX_PROVIDER_FEE_EXPENSE: 3204,
  TREASURY_FX_ADJUSTMENT_CHARGE: 3205,
  TREASURY_FX_ADJUSTMENT_REFUND: 3206,
  PAYOUT_INITIATED: 3101,
  INTERNAL_TRANSFER: 4001,
  EXTERNAL_FUNDING_FOUNDER_EQUITY: 9001,
  EXTERNAL_FUNDING_INVESTOR_EQUITY: 9002,
  EXTERNAL_FUNDING_SHAREHOLDER_LOAN: 9003,
  EXTERNAL_FUNDING_OPENING_BALANCE: 9005,
} as const;

export type TransferCode = (typeof TransferCodes)[keyof typeof TransferCodes];

export const CLEARING_KIND_DIMENSION_RULES = {
  [CLEARING_KIND.INTERCOMPANY]: [
    { dimensionKey: DIM.counterpartyId, mode: "required" },
    { dimensionKey: DIM.orderId, mode: "forbidden" },
    { dimensionKey: DIM.customerId, mode: "forbidden" },
    { dimensionKey: DIM.organizationRequisiteId, mode: "forbidden" },
    { dimensionKey: DIM.feeBucket, mode: "forbidden" },
  ],
  [CLEARING_KIND.TREASURY_FX]: [
    { dimensionKey: DIM.counterpartyId, mode: "optional" },
    { dimensionKey: DIM.orderId, mode: "required" },
    { dimensionKey: DIM.customerId, mode: "forbidden" },
    { dimensionKey: DIM.organizationRequisiteId, mode: "forbidden" },
    { dimensionKey: DIM.feeBucket, mode: "forbidden" },
  ],
} as const satisfies Record<string, ClearingKindDimensionRule[]>;

const accountNoSchema = z.string().regex(ACCOUNT_NO_REGEX);

const accountingDefaultsSchema = z.object({
  chartTemplateAccounts: z.array(
    z.object({
      accountNo: accountNoSchema,
      name: z.string().min(1),
      kind: z.enum(CHART_ACCOUNT_KIND_VALUES),
      normalSide: z.enum(CHART_NORMAL_SIDE_VALUES),
      postingAllowed: z.boolean(),
      enabled: z.boolean(),
      parentAccountNo: accountNoSchema.nullable(),
    }),
  ),
  accountDimensionPolicies: z.array(
    z.object({
      accountNo: accountNoSchema,
      dimensionKey: z.string().min(1),
      mode: z.enum(DIMENSION_MODE_VALUES),
    }),
  ),
  postingCodeDimensionPolicies: z.array(
    z.object({
      postingCode: z.string().min(1),
      dimensionKey: z.string().min(1),
      required: z.boolean(),
      scope: z.enum(DIMENSION_POLICY_SCOPE_VALUES),
    }),
  ),
  globalCorrespondenceRules: z.array(
    z.object({
      postingCode: z.string().min(1),
      debitAccountNo: accountNoSchema,
      creditAccountNo: accountNoSchema,
      enabled: z.boolean().default(true),
    }),
  ),
});

const accountingDefaults = accountingDefaultsSchema.parse(
  accountingDefaultsRaw as unknown,
);

const accountingReportLineMappingsSchema = z.object({
  reportLineMappings: z.array(
    z.object({
      standard: z.string().min(1),
      reportKind: z.enum(REPORT_KIND_VALUES),
      lineCode: z.string().min(1),
      lineLabel: z.string().min(1),
      section: z.string().min(1),
      accountNo: accountNoSchema,
      signMultiplier: z.number().int(),
    }),
  ),
});

const accountingReportLineMappings =
  accountingReportLineMappingsSchema.parse(
    accountingReportLineMappingsRaw as unknown,
  );

const defaultChartAccountNoSet = new Set(
  accountingDefaults.chartTemplateAccounts.map((account) => account.accountNo),
);

for (const mapping of accountingReportLineMappings.reportLineMappings) {
  if (!defaultChartAccountNoSet.has(mapping.accountNo)) {
    throw new Error(
      `Accounting report line mapping references unknown account ${mapping.accountNo}`,
    );
  }
}

export const DEFAULT_CHART_TEMPLATE_ACCOUNTS =
  accountingDefaults.chartTemplateAccounts;
export const DEFAULT_ACCOUNT_DIMENSION_POLICIES: AccountDimensionPolicy[] =
  accountingDefaults.accountDimensionPolicies;
export const DEFAULT_POSTING_CODE_DIMENSION_POLICIES: PostingCodeDimensionPolicyEntry[] =
  accountingDefaults.postingCodeDimensionPolicies;
export const DEFAULT_GLOBAL_CORRESPONDENCE_RULES =
  accountingDefaults.globalCorrespondenceRules;
export const DEFAULT_REPORT_LINE_MAPPINGS_EFFECTIVE_FROM = new Date(
  "2000-01-01T00:00:00.000Z",
);
export const DEFAULT_REPORT_LINE_MAPPINGS: AccountingReportLineMappingDefault[] =
  accountingReportLineMappings.reportLineMappings;
