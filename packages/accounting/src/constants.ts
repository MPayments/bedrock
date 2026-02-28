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
  operationalAccountId: "operationalAccountId",
  counterpartyId: "counterpartyId",
  customerId: "customerId",
  orderId: "orderId",
  feeBucket: "feeBucket",
  clearingKind: "clearingKind",
} as const;

export type DimensionKey = (typeof DIM)[keyof typeof DIM];
export type Dimensions = Record<string, string>;

export const KNOWN_DIMENSION_KEYS = new Set<string>(Object.values(DIM));

export const CLEARING_KIND = {
  INTERCOMPANY: "intercompany",
  TREASURY_FX: "treasury_fx",
} as const;

export const OPERATION_CODE = {
  TRANSFER_APPROVE_IMMEDIATE_INTRA: "TRANSFER_APPROVE_IMMEDIATE_INTRA",
  TRANSFER_APPROVE_PENDING_INTRA: "TRANSFER_APPROVE_PENDING_INTRA",
  TRANSFER_APPROVE_IMMEDIATE_CROSS: "TRANSFER_APPROVE_IMMEDIATE_CROSS",
  TRANSFER_APPROVE_PENDING_CROSS: "TRANSFER_APPROVE_PENDING_CROSS",
  TRANSFER_SETTLE_PENDING: "TRANSFER_SETTLE_PENDING",
  TRANSFER_VOID_PENDING: "TRANSFER_VOID_PENDING",

  TREASURY_FUNDING_SETTLED: "TREASURY_FUNDING_SETTLED",
  TREASURY_EXTERNAL_FUNDING: "TREASURY_EXTERNAL_FUNDING",
  TREASURY_FX_EXECUTED: "TREASURY_FX_EXECUTED",
  TREASURY_PAYOUT_INIT: "TREASURY_PAYOUT_INIT",
  TREASURY_PAYOUT_SETTLE: "TREASURY_PAYOUT_SETTLE",
  TREASURY_PAYOUT_VOID: "TREASURY_PAYOUT_VOID",
  TREASURY_FEE_PAYMENT_INIT: "TREASURY_FEE_PAYMENT_INIT",
  TREASURY_FEE_PAYMENT_SETTLE: "TREASURY_FEE_PAYMENT_SETTLE",
  TREASURY_FEE_PAYMENT_VOID: "TREASURY_FEE_PAYMENT_VOID",
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

  FEE_INCOME: "TC.3001",
  SPREAD_INCOME: "TC.3002",
  FEE_PASS_THROUGH_RESERVE: "TC.3003",
  ADJUSTMENT_CHARGE: "TC.3006",
  ADJUSTMENT_REFUND: "TC.3007",
  PROVIDER_FEE_EXPENSE_ACCRUAL: "TC.3008",
  FEE_PAYMENT_INITIATED: "TC.3011",
  PAYOUT_INITIATED: "TC.3101",
} as const;

export type DimensionMode = "required" | "optional" | "forbidden";
export type DimensionPolicyScope = "line" | "debit" | "credit";

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

export const CLEARING_KIND_DIMENSION_RULES: Record<string, ClearingKindDimensionRule[]> = {
  [CLEARING_KIND.INTERCOMPANY]: [
    { dimensionKey: DIM.counterpartyId, mode: "required" },
    { dimensionKey: DIM.orderId, mode: "forbidden" },
    { dimensionKey: DIM.customerId, mode: "forbidden" },
    { dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
    { dimensionKey: DIM.feeBucket, mode: "forbidden" },
  ],
  [CLEARING_KIND.TREASURY_FX]: [
    { dimensionKey: DIM.counterpartyId, mode: "required" },
    { dimensionKey: DIM.orderId, mode: "required" },
    { dimensionKey: DIM.customerId, mode: "forbidden" },
    { dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
    { dimensionKey: DIM.feeBucket, mode: "forbidden" },
  ],
};

export const DEFAULT_CHART_TEMPLATE_ACCOUNTS = [
  {
    accountNo: ACCOUNT_NO.ASSETS,
    name: "Активы",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: null,
  },
  {
    accountNo: ACCOUNT_NO.CASH_AND_EQUIVALENTS,
    name: "Денежные средства и эквиваленты",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.ASSETS,
  },
  {
    accountNo: ACCOUNT_NO.OPERATING_ASSETS,
    name: "Операционные активы",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.ASSETS,
  },
  {
    accountNo: ACCOUNT_NO.CLEARING_GROUP,
    name: "Клиринг (группа)",
    kind: "active_passive",
    normalSide: "both",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.ASSETS,
  },
  {
    accountNo: ACCOUNT_NO.CLEARING,
    name: "Клиринг",
    kind: "active_passive",
    normalSide: "both",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.CLEARING_GROUP,
  },
  {
    accountNo: ACCOUNT_NO.LIABILITIES,
    name: "Обязательства",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: null,
  },
  {
    accountNo: ACCOUNT_NO.OPERATING_LIABILITIES,
    name: "Операционные обязательства",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.LIABILITIES,
  },
  {
    accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN,
    name: "Займ от учредителя/инвестора",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.LIABILITIES,
  },
  {
    accountNo: ACCOUNT_NO.EQUITY,
    name: "Капитал",
    kind: "equity",
    normalSide: "credit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: null,
  },
  {
    accountNo: ACCOUNT_NO.FOUNDER_EQUITY,
    name: "Вклад учредителя",
    kind: "equity",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.EQUITY,
  },
  {
    accountNo: ACCOUNT_NO.INVESTOR_EQUITY,
    name: "Инвестиции в капитал",
    kind: "equity",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.EQUITY,
  },
  {
    accountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
    name: "Балансирующий капитал",
    kind: "equity",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.EQUITY,
  },
  {
    accountNo: ACCOUNT_NO.REVENUES,
    name: "Доходы",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: null,
  },
  {
    accountNo: ACCOUNT_NO.EXPENSES,
    name: "Расходы",
    kind: "expense",
    normalSide: "debit",
    postingAllowed: false,
    enabled: true,
    parentAccountNo: null,
  },
  {
    accountNo: ACCOUNT_NO.BANK,
    name: "Банк",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.CASH_AND_EQUIVALENTS,
  },
  {
    accountNo: ACCOUNT_NO.TRANSIT,
    name: "Транзит",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.OPERATING_ASSETS,
  },
  {
    accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    name: "Кошелек клиента",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.OPERATING_LIABILITIES,
  },
  {
    accountNo: ACCOUNT_NO.FEE_CLEARING,
    name: "Клиринг комиссий",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.OPERATING_LIABILITIES,
  },
  {
    accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
    name: "Обязательство по выплате",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.OPERATING_LIABILITIES,
  },
  {
    accountNo: ACCOUNT_NO.ORDER_RESERVE,
    name: "ORDER_RESERVE",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.OPERATING_LIABILITIES,
  },
  {
    accountNo: ACCOUNT_NO.FEE_REVENUE,
    name: "Доход от комиссий",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.REVENUES,
  },
  {
    accountNo: ACCOUNT_NO.SPREAD_REVENUE,
    name: "Доход от спреда",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.REVENUES,
  },
  {
    accountNo: ACCOUNT_NO.ADJUSTMENT_REVENUE,
    name: "Доход от корректировок",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.REVENUES,
  },
  {
    accountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
    name: "Расход по корректировкам",
    kind: "expense",
    normalSide: "debit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.EXPENSES,
  },
  {
    accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
    name: "PROVIDER_FEE_EXPENSE",
    kind: "expense",
    normalSide: "debit",
    postingAllowed: true,
    enabled: true,
    parentAccountNo: ACCOUNT_NO.EXPENSES,
  },
] as const;

export const DEFAULT_ACCOUNT_DIMENSION_POLICIES: AccountDimensionPolicy[] = [
  // BANK: only operationalAccountId, everything else forbidden
  { accountNo: ACCOUNT_NO.BANK, dimensionKey: DIM.operationalAccountId, mode: "required" },
  { accountNo: ACCOUNT_NO.BANK, dimensionKey: DIM.orderId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.BANK, dimensionKey: DIM.customerId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.BANK, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.BANK, dimensionKey: DIM.clearingKind, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.BANK, dimensionKey: DIM.counterpartyId, mode: "forbidden" },

  // CUSTOMER_WALLET: only customerId
  { accountNo: ACCOUNT_NO.CUSTOMER_WALLET, dimensionKey: DIM.customerId, mode: "required" },
  { accountNo: ACCOUNT_NO.CUSTOMER_WALLET, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.CUSTOMER_WALLET, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.CUSTOMER_WALLET, dimensionKey: DIM.clearingKind, mode: "forbidden" },

  // CLEARING (1310): clearingKind required; conditional rules enforced in code
  { accountNo: ACCOUNT_NO.CLEARING, dimensionKey: DIM.clearingKind, mode: "required" },
  { accountNo: ACCOUNT_NO.CLEARING, dimensionKey: DIM.counterpartyId, mode: "optional" },
  { accountNo: ACCOUNT_NO.CLEARING, dimensionKey: DIM.orderId, mode: "optional" },
  { accountNo: ACCOUNT_NO.CLEARING, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.CLEARING, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.CLEARING, dimensionKey: DIM.customerId, mode: "forbidden" },

  // ORDER_RESERVE: orderId required, customerId optional
  { accountNo: ACCOUNT_NO.ORDER_RESERVE, dimensionKey: DIM.orderId, mode: "required" },
  { accountNo: ACCOUNT_NO.ORDER_RESERVE, dimensionKey: DIM.customerId, mode: "optional" },
  { accountNo: ACCOUNT_NO.ORDER_RESERVE, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.ORDER_RESERVE, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.ORDER_RESERVE, dimensionKey: DIM.clearingKind, mode: "forbidden" },

  // FEE_CLEARING: feeBucket+orderId required, counterpartyId optional
  { accountNo: ACCOUNT_NO.FEE_CLEARING, dimensionKey: DIM.feeBucket, mode: "required" },
  { accountNo: ACCOUNT_NO.FEE_CLEARING, dimensionKey: DIM.orderId, mode: "required" },
  { accountNo: ACCOUNT_NO.FEE_CLEARING, dimensionKey: DIM.counterpartyId, mode: "optional" },
  { accountNo: ACCOUNT_NO.FEE_CLEARING, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.FEE_CLEARING, dimensionKey: DIM.clearingKind, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.FEE_CLEARING, dimensionKey: DIM.customerId, mode: "forbidden" },

  // PAYOUT_OBLIGATION: orderId required, counterpartyId optional
  { accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION, dimensionKey: DIM.orderId, mode: "required" },
  { accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION, dimensionKey: DIM.counterpartyId, mode: "optional" },
  { accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION, dimensionKey: DIM.clearingKind, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION, dimensionKey: DIM.customerId, mode: "forbidden" },

  // EXTERNAL FUNDING LIABILITY/EQUITY ACCOUNTS
  { accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN, dimensionKey: DIM.counterpartyId, mode: "required" },
  { accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN, dimensionKey: DIM.orderId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN, dimensionKey: DIM.customerId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN, dimensionKey: DIM.clearingKind, mode: "forbidden" },

  { accountNo: ACCOUNT_NO.FOUNDER_EQUITY, dimensionKey: DIM.counterpartyId, mode: "required" },
  { accountNo: ACCOUNT_NO.FOUNDER_EQUITY, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.FOUNDER_EQUITY, dimensionKey: DIM.orderId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.FOUNDER_EQUITY, dimensionKey: DIM.customerId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.FOUNDER_EQUITY, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.FOUNDER_EQUITY, dimensionKey: DIM.clearingKind, mode: "forbidden" },

  { accountNo: ACCOUNT_NO.INVESTOR_EQUITY, dimensionKey: DIM.counterpartyId, mode: "required" },
  { accountNo: ACCOUNT_NO.INVESTOR_EQUITY, dimensionKey: DIM.operationalAccountId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.INVESTOR_EQUITY, dimensionKey: DIM.orderId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.INVESTOR_EQUITY, dimensionKey: DIM.customerId, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.INVESTOR_EQUITY, dimensionKey: DIM.feeBucket, mode: "forbidden" },
  { accountNo: ACCOUNT_NO.INVESTOR_EQUITY, dimensionKey: DIM.clearingKind, mode: "forbidden" },

  // PROVIDER_FEE_EXPENSE: feeBucket+orderId required, counterpartyId optional
  { accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE, dimensionKey: DIM.feeBucket, mode: "required" },
  { accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE, dimensionKey: DIM.orderId, mode: "required" },
  { accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE, dimensionKey: DIM.counterpartyId, mode: "optional" },
];

// Side-aware: scope indicates where the dimension must appear.
// "line" = union of debit+credit, "debit" = debit only, "credit" = credit only.
export const DEFAULT_POSTING_CODE_DIMENSION_POLICIES: PostingCodeDimensionPolicyEntry[] = [
  // --- Transfers ---
  { postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE, dimensionKey: DIM.operationalAccountId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.TRANSFER_INTRA_PENDING, dimensionKey: DIM.operationalAccountId, required: true, scope: "line" },

  // CROSS SOURCE: CLEARING(debit) → BANK(credit)
  { postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE, dimensionKey: DIM.counterpartyId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE, dimensionKey: DIM.operationalAccountId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE, dimensionKey: DIM.counterpartyId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING, dimensionKey: DIM.counterpartyId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING, dimensionKey: DIM.operationalAccountId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_PENDING, dimensionKey: DIM.counterpartyId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_PENDING, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },

  // --- Funding ---
  // BANK(debit) → CUSTOMER_WALLET(credit)
  { postingCode: POSTING_CODE.FUNDING_SETTLED, dimensionKey: DIM.customerId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.FUNDING_SETTLED, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY, dimensionKey: DIM.counterpartyId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY, dimensionKey: DIM.counterpartyId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN, dimensionKey: DIM.counterpartyId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE, dimensionKey: DIM.operationalAccountId, required: true, scope: "debit" },

  // --- FX ---
  // CW(debit) → ORDER_RESERVE(credit)
  { postingCode: POSTING_CODE.FX_PRINCIPAL, dimensionKey: DIM.orderId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.FX_PRINCIPAL, dimensionKey: DIM.customerId, required: true, scope: "debit" },

  // ORDER_RESERVE(debit) → CLEARING(credit)
  { postingCode: POSTING_CODE.FX_LEG_OUT, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.FX_LEG_OUT, dimensionKey: DIM.counterpartyId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.FX_LEG_OUT, dimensionKey: DIM.clearingKind, required: true, scope: "credit" },

  // CLEARING(debit) → ORDER_RESERVE(credit)
  { postingCode: POSTING_CODE.FX_LEG_IN, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.FX_LEG_IN, dimensionKey: DIM.counterpartyId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.FX_LEG_IN, dimensionKey: DIM.clearingKind, required: true, scope: "debit" },

  // ORDER_RESERVE(debit) → PAYOUT_OBLIGATION(credit)
  { postingCode: POSTING_CODE.FX_PAYOUT_OBLIGATION, dimensionKey: DIM.orderId, required: true, scope: "line" },

  // --- Fee income (CW → revenue) ---
  { postingCode: POSTING_CODE.FEE_INCOME, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.FEE_INCOME, dimensionKey: DIM.customerId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.FEE_INCOME, dimensionKey: DIM.feeBucket, required: true, scope: "line" },

  { postingCode: POSTING_CODE.SPREAD_INCOME, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.SPREAD_INCOME, dimensionKey: DIM.customerId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.SPREAD_INCOME, dimensionKey: DIM.feeBucket, required: true, scope: "line" },

  // CW/ADJ_EXPENSE → FEE_CLEARING
  { postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE, dimensionKey: DIM.feeBucket, required: true, scope: "line" },

  // PROVIDER_FEE_EXPENSE → FEE_CLEARING
  { postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL, dimensionKey: DIM.feeBucket, required: true, scope: "line" },
  { postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL, dimensionKey: DIM.counterpartyId, required: true, scope: "line" },

  // FEE_CLEARING(debit) → BANK(credit)
  { postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED, dimensionKey: DIM.orderId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED, dimensionKey: DIM.feeBucket, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED, dimensionKey: DIM.counterpartyId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED, dimensionKey: DIM.operationalAccountId, required: true, scope: "credit" },

  // PAYOUT_OBLIGATION(debit) → BANK(credit)
  { postingCode: POSTING_CODE.PAYOUT_INITIATED, dimensionKey: DIM.orderId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.PAYOUT_INITIATED, dimensionKey: DIM.operationalAccountId, required: true, scope: "credit" },

  // --- Adjustments (CW ↔ revenue/expense) ---
  { postingCode: POSTING_CODE.ADJUSTMENT_CHARGE, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.ADJUSTMENT_CHARGE, dimensionKey: DIM.customerId, required: true, scope: "debit" },
  { postingCode: POSTING_CODE.ADJUSTMENT_CHARGE, dimensionKey: DIM.feeBucket, required: true, scope: "line" },

  { postingCode: POSTING_CODE.ADJUSTMENT_REFUND, dimensionKey: DIM.orderId, required: true, scope: "line" },
  { postingCode: POSTING_CODE.ADJUSTMENT_REFUND, dimensionKey: DIM.customerId, required: true, scope: "credit" },
  { postingCode: POSTING_CODE.ADJUSTMENT_REFUND, dimensionKey: DIM.feeBucket, required: true, scope: "line" },
];

export const DEFAULT_GLOBAL_CORRESPONDENCE_RULES = [
  {
    postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_INTRA_PENDING,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE,
    debitAccountNo: ACCOUNT_NO.CLEARING,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.CLEARING,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING,
    debitAccountNo: ACCOUNT_NO.CLEARING,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_PENDING,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.CLEARING,
  },
  {
    postingCode: POSTING_CODE.FUNDING_SETTLED,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
  },
  {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.FOUNDER_EQUITY,
  },
  {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.INVESTOR_EQUITY,
  },
  {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.SHAREHOLDER_LOAN,
  },
  {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
  },
  {
    postingCode: POSTING_CODE.FX_PRINCIPAL,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.ORDER_RESERVE,
  },
  {
    postingCode: POSTING_CODE.FX_LEG_OUT,
    debitAccountNo: ACCOUNT_NO.ORDER_RESERVE,
    creditAccountNo: ACCOUNT_NO.CLEARING,
  },
  {
    postingCode: POSTING_CODE.FX_LEG_IN,
    debitAccountNo: ACCOUNT_NO.CLEARING,
    creditAccountNo: ACCOUNT_NO.ORDER_RESERVE,
  },
  {
    postingCode: POSTING_CODE.FX_PAYOUT_OBLIGATION,
    debitAccountNo: ACCOUNT_NO.ORDER_RESERVE,
    creditAccountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
  },
  {
    postingCode: POSTING_CODE.FEE_INCOME,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
  },
  {
    postingCode: POSTING_CODE.SPREAD_INCOME,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.SPREAD_REVENUE,
  },
  {
    postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
  },
  {
    postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL,
    debitAccountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
  },
  {
    postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED,
    debitAccountNo: ACCOUNT_NO.FEE_CLEARING,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.PAYOUT_INITIATED,
    debitAccountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.ADJUSTMENT_CHARGE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.ADJUSTMENT_REVENUE,
  },
  {
    postingCode: POSTING_CODE.ADJUSTMENT_REFUND,
    debitAccountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
    creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
  },
] as const;
