export const ACCOUNTING_SOURCE_ID = {
  TRANSFER_INTRA: "transfer_intra",
  TRANSFER_INTERCOMPANY: "transfer_intercompany",
  TRANSFER_RESOLUTION_SETTLE: "transfer_resolution_settle",
  TRANSFER_RESOLUTION_VOID: "transfer_resolution_void",
  TREASURY_FX_EXECUTE: "treasury_fx_execute",
  TREASURY_FX_RESOLUTION_SETTLE: "treasury_fx_resolution_settle",
  TREASURY_FX_RESOLUTION_VOID: "treasury_fx_resolution_void",
  PAYMENT_CASE: "payment_case",
  PAYIN_FUNDING: "payin_funding",
  FX_EXECUTE: "fx_execute",
  INVOICE_DIRECT: "invoice_direct",
  INVOICE_INVENTORY_FINALIZE: "invoice_inventory_finalize",
  INVOICE_RESERVE: "invoice_reserve",
  PAYOUT_INITIATE: "payout_initiate",
  PAYOUT_SETTLE: "payout_settle",
  PAYOUT_VOID: "payout_void",
  FEE_PAYOUT_INITIATE: "fee_payout_initiate",
  FEE_PAYOUT_SETTLE: "fee_payout_settle",
  FEE_PAYOUT_VOID: "fee_payout_void",
  CAPITAL_FUNDING: "capital_funding",
} as const;

export type AccountingSourceId =
  (typeof ACCOUNTING_SOURCE_ID)[keyof typeof ACCOUNTING_SOURCE_ID];

export const OPERATION_CODE = {
  TRANSFER_APPROVE_IMMEDIATE_INTRA: "TRANSFER_APPROVE_IMMEDIATE_INTRA",
  TRANSFER_APPROVE_PENDING_INTRA: "TRANSFER_APPROVE_PENDING_INTRA",
  TRANSFER_APPROVE_IMMEDIATE_CROSS: "TRANSFER_APPROVE_IMMEDIATE_CROSS",
  TRANSFER_APPROVE_PENDING_CROSS: "TRANSFER_APPROVE_PENDING_CROSS",
  TRANSFER_SETTLE_PENDING: "TRANSFER_SETTLE_PENDING",
  TRANSFER_VOID_PENDING: "TRANSFER_VOID_PENDING",
  TREASURY_FX_EXECUTE_IMMEDIATE: "TREASURY_FX_EXECUTE_IMMEDIATE",
  TREASURY_FX_EXECUTE_PENDING: "TREASURY_FX_EXECUTE_PENDING",
  TREASURY_FX_SETTLE_PENDING: "TREASURY_FX_SETTLE_PENDING",
  TREASURY_FX_VOID_PENDING: "TREASURY_FX_VOID_PENDING",
  TREASURY_FUNDING_SETTLED: "TREASURY_FUNDING_SETTLED",
  TREASURY_EXTERNAL_FUNDING: "TREASURY_EXTERNAL_FUNDING",
  TREASURY_FX_EXECUTED: "TREASURY_FX_EXECUTED",
  TREASURY_PAYOUT_INIT: "TREASURY_PAYOUT_INIT",
  TREASURY_PAYOUT_SETTLE: "TREASURY_PAYOUT_SETTLE",
  TREASURY_PAYOUT_VOID: "TREASURY_PAYOUT_VOID",
  TREASURY_FEE_PAYMENT_INIT: "TREASURY_FEE_PAYMENT_INIT",
  TREASURY_FEE_PAYMENT_SETTLE: "TREASURY_FEE_PAYMENT_SETTLE",
  TREASURY_FEE_PAYMENT_VOID: "TREASURY_FEE_PAYMENT_VOID",
  TREASURY_CAPITAL_FUNDING: "TREASURY_CAPITAL_FUNDING",
  COMMERCIAL_INVOICE_DIRECT: "COMMERCIAL_INVOICE_DIRECT",
  COMMERCIAL_INVOICE_INVENTORY_FINALIZE:
    "COMMERCIAL_INVOICE_INVENTORY_FINALIZE",
  COMMERCIAL_INVOICE_RESERVE: "COMMERCIAL_INVOICE_RESERVE",
} as const;

export type OperationCode =
  (typeof OPERATION_CODE)[keyof typeof OPERATION_CODE];

export const POSTING_TEMPLATE_KEY = {
  TRANSFER_INTRA_IMMEDIATE: "transfer.intra.immediate",
  TRANSFER_INTRA_PENDING: "transfer.intra.pending",
  TRANSFER_CROSS_SOURCE_IMMEDIATE: "transfer.cross.source.immediate",
  TRANSFER_CROSS_SOURCE_PENDING: "transfer.cross.source.pending",
  TRANSFER_CROSS_DESTINATION_IMMEDIATE: "transfer.cross.destination.immediate",
  TRANSFER_CROSS_DESTINATION_PENDING: "transfer.cross.destination.pending",
  TRANSFER_PENDING_SETTLE: "transfer.pending.settle",
  TRANSFER_PENDING_VOID: "transfer.pending.void",
  TREASURY_FX_SOURCE_IMMEDIATE: "treasury.fx.source.immediate",
  TREASURY_FX_SOURCE_PENDING: "treasury.fx.source.pending",
  TREASURY_FX_DESTINATION_IMMEDIATE: "treasury.fx.destination.immediate",
  TREASURY_FX_DESTINATION_PENDING: "treasury.fx.destination.pending",
  TREASURY_FX_PENDING_SETTLE: "treasury.fx.pending.settle",
  TREASURY_FX_PENDING_VOID: "treasury.fx.pending.void",
  TREASURY_FX_FEE_INCOME: "treasury.fx.fee_income",
  TREASURY_FX_SPREAD_INCOME: "treasury.fx.spread_income",
  TREASURY_FX_PASS_THROUGH: "treasury.fx.pass_through",
  TREASURY_FX_PASS_THROUGH_REVERSAL:
    "treasury.fx.pass_through.reversal",
  TREASURY_FX_PROVIDER_FEE_EXPENSE:
    "treasury.fx.provider_fee_expense",
  TREASURY_FX_PROVIDER_FEE_EXPENSE_REVERSAL:
    "treasury.fx.provider_fee_expense.reversal",
  TREASURY_FX_ADJUSTMENT_CHARGE: "treasury.fx.adjustment.charge",
  TREASURY_FX_ADJUSTMENT_REFUND: "treasury.fx.adjustment.refund",
  EXTERNAL_FUNDING_FOUNDER_EQUITY: "external_funding.founder_equity",
  EXTERNAL_FUNDING_INVESTOR_EQUITY: "external_funding.investor_equity",
  EXTERNAL_FUNDING_SHAREHOLDER_LOAN: "external_funding.shareholder_loan",
  EXTERNAL_FUNDING_OPENING_BALANCE: "external_funding.opening_balance",
  CAPITAL_FUNDING_FOUNDER_EQUITY: "capital_funding.founder_equity",
  CAPITAL_FUNDING_INVESTOR_EQUITY: "capital_funding.investor_equity",
  CAPITAL_FUNDING_SHAREHOLDER_LOAN: "capital_funding.shareholder_loan",
  CAPITAL_FUNDING_OPENING_BALANCE: "capital_funding.opening_balance",
  PAYMENT_PAYIN_FUNDING: "payment.payin_funding",
  PAYMENT_FX_PRINCIPAL: "payment.fx.principal",
  PAYMENT_FX_LEG_OUT: "payment.fx.leg_out",
  PAYMENT_FX_LEG_IN: "payment.fx.leg_in",
  PAYMENT_FX_FEE_INCOME: "payment.fx.fee_income",
  PAYMENT_FX_FEE_INCOME_FROM_RESERVE: "payment.fx.fee_income.from_reserve",
  PAYMENT_FX_SPREAD_INCOME: "payment.fx.spread_income",
  PAYMENT_FX_SPREAD_INCOME_FROM_RESERVE:
    "payment.fx.spread_income.from_reserve",
  PAYMENT_FX_FEE_RESERVE: "payment.fx.fee_reserve",
  PAYMENT_FX_FEE_RESERVE_REVERSAL: "payment.fx.fee_reserve.reversal",
  PAYMENT_FX_PROVIDER_FEE_EXPENSE: "payment.fx.provider_fee_expense",
  PAYMENT_FX_PROVIDER_FEE_EXPENSE_REVERSAL:
    "payment.fx.provider_fee_expense.reversal",
  PAYMENT_FX_ADJUSTMENT_CHARGE: "payment.fx.adjustment.charge",
  PAYMENT_FX_ADJUSTMENT_REFUND: "payment.fx.adjustment.refund",
  PAYMENT_FX_ADJUSTMENT_CHARGE_FROM_RESERVE:
    "payment.fx.adjustment.charge.from_reserve",
  PAYMENT_FX_ADJUSTMENT_CHARGE_RESERVE: "payment.fx.adjustment.charge_reserve",
  PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE: "payment.fx.adjustment.refund_reserve",
  PAYMENT_FX_PAYOUT_OBLIGATION: "payment.fx.payout_obligation",
  PAYMENT_PAYOUT_INITIATE: "payment.payout.initiate",
  PAYMENT_PAYOUT_SETTLE: "payment.payout.settle",
  PAYMENT_PAYOUT_VOID: "payment.payout.void",
  PAYMENT_FEE_PAYOUT_INITIATE: "payment.fee_payout.initiate",
  PAYMENT_FEE_PAYOUT_SETTLE: "payment.fee_payout.settle",
  PAYMENT_FEE_PAYOUT_VOID: "payment.fee_payout.void",
} as const;

export type PostingTemplateKey =
  (typeof POSTING_TEMPLATE_KEY)[keyof typeof POSTING_TEMPLATE_KEY];
