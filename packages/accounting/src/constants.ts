export const ACCOUNT_NO = {
  BANK: "51.01",
  ORDER_INVENTORY: "57.01",
  TRANSIT: "57.02",
  CUSTOMER_WALLET: "62.01",
  FEE_CLEARING: "76.10",
  PAYOUT_OBLIGATION: "76.20",
  INTERCOMPANY_NET: "79.01",
  FEE_REVENUE: "90.01",
  SPREAD_REVENUE: "90.02",
  ADJUSTMENT_REVENUE: "91.01",
  ADJUSTMENT_EXPENSE: "91.02",
} as const;

export const OPERATION_CODE = {
  TRANSFER_APPROVE_IMMEDIATE_INTRA: "TRANSFER_APPROVE_IMMEDIATE_INTRA",
  TRANSFER_APPROVE_PENDING_INTRA: "TRANSFER_APPROVE_PENDING_INTRA",
  TRANSFER_APPROVE_IMMEDIATE_CROSS: "TRANSFER_APPROVE_IMMEDIATE_CROSS",
  TRANSFER_APPROVE_PENDING_CROSS: "TRANSFER_APPROVE_PENDING_CROSS",
  TRANSFER_SETTLE_PENDING: "TRANSFER_SETTLE_PENDING",
  TRANSFER_VOID_PENDING: "TRANSFER_VOID_PENDING",

  TREASURY_FUNDING_SETTLED: "TREASURY_FUNDING_SETTLED",
  TREASURY_FX_EXECUTED: "TREASURY_FX_EXECUTED",
  TREASURY_PAYOUT_INIT: "TREASURY_PAYOUT_INIT",
  TREASURY_PAYOUT_SETTLE: "TREASURY_PAYOUT_SETTLE",
  TREASURY_PAYOUT_VOID: "TREASURY_PAYOUT_VOID",
  TREASURY_FEE_PAYMENT_INIT: "TREASURY_FEE_PAYMENT_INIT",
  TREASURY_FEE_PAYMENT_SETTLE: "TREASURY_FEE_PAYMENT_SETTLE",
  TREASURY_FEE_PAYMENT_VOID: "TREASURY_FEE_PAYMENT_VOID",
} as const;

export const POSTING_CODE = {
  // Transfers
  TRANSFER_INTRA_IMMEDIATE: "TR.INTRA.IMMEDIATE",
  TRANSFER_INTRA_PENDING: "TR.INTRA.PENDING",
  TRANSFER_CROSS_SOURCE_IMMEDIATE: "TR.CROSS.SOURCE.IMMEDIATE",
  TRANSFER_CROSS_DEST_IMMEDIATE: "TR.CROSS.DEST.IMMEDIATE",
  TRANSFER_CROSS_SOURCE_PENDING: "TR.CROSS.SOURCE.PENDING",
  TRANSFER_CROSS_DEST_PENDING: "TR.CROSS.DEST.PENDING",

  // Treasury / transfer code mapping
  FUNDING_SETTLED: "TC.1001",
  FX_PRINCIPAL: "TC.2001",
  FEE_REVENUE: "TC.2002",
  SPREAD_REVENUE: "TC.2003",
  FX_INTERCOMPANY_COMMIT: "TC.2004",
  FX_PAYOUT_OBLIGATION: "TC.2005",
  BANK_FEE_REVENUE: "TC.2006",
  BLOCKCHAIN_FEE_REVENUE: "TC.2007",
  ARBITRARY_FEE_REVENUE: "TC.2008",
  FX_LEG_OUT: "TC.2009",
  FX_LEG_IN: "TC.2010",
  PAYOUT_INITIATED: "TC.3001",
  FEE_SEPARATE_PAYMENT_RESERVE: "TC.3002",
  FEE_PAYMENT_INITIATED: "TC.3003",
  FEE_PAYMENT_SETTLED: "TC.3004",
  FEE_PAYMENT_VOIDED: "TC.3005",
  ADJUSTMENT_CHARGE: "TC.3006",
  ADJUSTMENT_REFUND: "TC.3007",
  INTERNAL_TRANSFER: "TC.4001",
} as const;

export type PostingCode = (typeof POSTING_CODE)[keyof typeof POSTING_CODE];

export const DEFAULT_CHART_TEMPLATE_ACCOUNTS = [
  {
    accountNo: ACCOUNT_NO.BANK,
    name: "Bank",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.ORDER_INVENTORY,
    name: "Order Inventory",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.TRANSIT,
    name: "Transit",
    kind: "asset",
    normalSide: "debit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    name: "Customer Wallet",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.FEE_CLEARING,
    name: "Fee Clearing",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
    name: "Payout Obligation",
    kind: "liability",
    normalSide: "credit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.INTERCOMPANY_NET,
    name: "Intercompany Net",
    kind: "active_passive",
    normalSide: "both",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.FEE_REVENUE,
    name: "Fee Revenue",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.SPREAD_REVENUE,
    name: "Spread Revenue",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.ADJUSTMENT_REVENUE,
    name: "Adjustment Revenue",
    kind: "revenue",
    normalSide: "credit",
    postingAllowed: true,
  },
  {
    accountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
    name: "Adjustment Expense",
    kind: "expense",
    normalSide: "debit",
    postingAllowed: true,
  },
] as const;

export const DEFAULT_CHART_TEMPLATE_ACCOUNT_ANALYTICS = [
  {
    accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    analyticType: "customer_id",
    required: true,
  },
  {
    accountNo: ACCOUNT_NO.ORDER_INVENTORY,
    analyticType: "order_id",
    required: true,
  },
  {
    accountNo: ACCOUNT_NO.FEE_CLEARING,
    analyticType: "fee_bucket",
    required: true,
  },
  {
    accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
    analyticType: "order_id",
    required: true,
  },
  {
    accountNo: ACCOUNT_NO.INTERCOMPANY_NET,
    analyticType: "counterparty_id",
    required: true,
  },
] as const;

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
    debitAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING,
    debitAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_PENDING,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
  },
  {
    postingCode: POSTING_CODE.FUNDING_SETTLED,
    debitAccountNo: ACCOUNT_NO.BANK,
    creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
  },
  {
    postingCode: POSTING_CODE.FX_PRINCIPAL,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.ORDER_INVENTORY,
  },
  {
    postingCode: POSTING_CODE.FX_LEG_OUT,
    debitAccountNo: ACCOUNT_NO.ORDER_INVENTORY,
    creditAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
  },
  {
    postingCode: POSTING_CODE.FX_LEG_IN,
    debitAccountNo: ACCOUNT_NO.INTERCOMPANY_NET,
    creditAccountNo: ACCOUNT_NO.ORDER_INVENTORY,
  },
  {
    postingCode: POSTING_CODE.FEE_REVENUE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
  },
  {
    postingCode: POSTING_CODE.SPREAD_REVENUE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.SPREAD_REVENUE,
  },
  {
    postingCode: POSTING_CODE.BANK_FEE_REVENUE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
  },
  {
    postingCode: POSTING_CODE.BLOCKCHAIN_FEE_REVENUE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
  },
  {
    postingCode: POSTING_CODE.ARBITRARY_FEE_REVENUE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_REVENUE,
  },
  {
    postingCode: POSTING_CODE.FX_PAYOUT_OBLIGATION,
    debitAccountNo: ACCOUNT_NO.ORDER_INVENTORY,
    creditAccountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
  },
  {
    postingCode: POSTING_CODE.PAYOUT_INITIATED,
    debitAccountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
    creditAccountNo: ACCOUNT_NO.BANK,
  },
  {
    postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED,
    debitAccountNo: ACCOUNT_NO.FEE_CLEARING,
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
  {
    postingCode: POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE,
    debitAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
  },
  {
    postingCode: POSTING_CODE.FEE_SEPARATE_PAYMENT_RESERVE,
    debitAccountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
    creditAccountNo: ACCOUNT_NO.FEE_CLEARING,
  },
] as const;
