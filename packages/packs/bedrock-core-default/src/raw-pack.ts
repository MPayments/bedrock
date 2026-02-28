import {
  AccountingPackDefinitionSchema,
  type AccountingPackDefinition,
  type CreatePostingTemplateDefinition,
  type PendingPostingTemplateDefinition,
  type ValueBinding,
} from "@bedrock/packs-schema";

const BOOK_REF_BOOK_ID = "bookId";

const ACCOUNT_NO = {
  BANK: "1110",
  CLEARING: "1310",
  CUSTOMER_WALLET: "2110",
  FEE_CLEARING: "2120",
  PAYOUT_OBLIGATION: "2130",
  ORDER_RESERVE: "2140",
  FOUNDER_EQUITY: "3110",
  INVESTOR_EQUITY: "3120",
  OPENING_BALANCE_EQUITY: "3200",
  SHAREHOLDER_LOAN: "2210",
  FEE_REVENUE: "4110",
  SPREAD_REVENUE: "4120",
  ADJUSTMENT_REVENUE: "4130",
  ADJUSTMENT_EXPENSE: "5110",
  PROVIDER_FEE_EXPENSE: "5120",
} as const;

const CLEARING_KIND = {
  INTERCOMPANY: "intercompany",
  TREASURY_FX: "treasury_fx",
} as const;

const POSTING_CODE = {
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

const TRANSFER_CODE = {
  FUNDING_SETTLED: 1001,
  FX_PRINCIPAL: 2001,
  FX_PAYOUT_OBLIGATION: 2005,
  FX_LEG_OUT: 2009,
  FX_LEG_IN: 2010,
  FEE_INCOME: 3001,
  SPREAD_INCOME: 3002,
  FEE_PASS_THROUGH_RESERVE: 3003,
  ADJUSTMENT_CHARGE: 3006,
  ADJUSTMENT_REFUND: 3007,
  PROVIDER_FEE_EXPENSE_ACCRUAL: 3008,
  FEE_PAYMENT_INITIATED: 3011,
  PAYOUT_INITIATED: 3101,
  INTERNAL_TRANSFER: 4001,
  EXTERNAL_FUNDING_FOUNDER_EQUITY: 9001,
  EXTERNAL_FUNDING_INVESTOR_EQUITY: 9002,
  EXTERNAL_FUNDING_SHAREHOLDER_LOAN: 9003,
  EXTERNAL_FUNDING_OPENING_BALANCE: 9005,
} as const;

const POSTING_TEMPLATE_KEY = {
  TRANSFER_INTRA_IMMEDIATE: "transfer.intra.immediate",
  TRANSFER_INTRA_PENDING: "transfer.intra.pending",
  TRANSFER_CROSS_SOURCE_IMMEDIATE: "transfer.cross.source.immediate",
  TRANSFER_CROSS_SOURCE_PENDING: "transfer.cross.source.pending",
  TRANSFER_CROSS_DESTINATION_IMMEDIATE: "transfer.cross.destination.immediate",
  TRANSFER_CROSS_DESTINATION_PENDING: "transfer.cross.destination.pending",
  TRANSFER_PENDING_SETTLE: "transfer.pending.settle",
  TRANSFER_PENDING_VOID: "transfer.pending.void",
  EXTERNAL_FUNDING_FOUNDER_EQUITY: "external_funding.founder_equity",
  EXTERNAL_FUNDING_INVESTOR_EQUITY: "external_funding.investor_equity",
  EXTERNAL_FUNDING_SHAREHOLDER_LOAN: "external_funding.shareholder_loan",
  EXTERNAL_FUNDING_OPENING_BALANCE: "external_funding.opening_balance",
  PAYMENT_PAYIN_FUNDING: "payment.payin_funding",
  PAYMENT_FX_PRINCIPAL: "payment.fx.principal",
  PAYMENT_FX_LEG_OUT: "payment.fx.leg_out",
  PAYMENT_FX_LEG_IN: "payment.fx.leg_in",
  PAYMENT_FX_FEE_INCOME: "payment.fx.fee_income",
  PAYMENT_FX_SPREAD_INCOME: "payment.fx.spread_income",
  PAYMENT_FX_FEE_RESERVE: "payment.fx.fee_reserve",
  PAYMENT_FX_PROVIDER_FEE_EXPENSE: "payment.fx.provider_fee_expense",
  PAYMENT_FX_ADJUSTMENT_CHARGE: "payment.fx.adjustment.charge",
  PAYMENT_FX_ADJUSTMENT_REFUND: "payment.fx.adjustment.refund",
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

function literal(value: string): ValueBinding {
  return { kind: "literal", value };
}

function dimension(key: string): ValueBinding {
  return { kind: "dimension", key };
}

function createTemplate(
  definition: Omit<CreatePostingTemplateDefinition, "lineType">,
): CreatePostingTemplateDefinition {
  return {
    lineType: "create",
    ...definition,
  };
}

function pendingTemplate(
  definition: PendingPostingTemplateDefinition,
): PendingPostingTemplateDefinition {
  return definition;
}

export const rawPackDefinition = AccountingPackDefinitionSchema.parse({
  packKey: "bedrock-core-default",
  version: 1,
  templates: [
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
      transferCode: TRANSFER_CODE.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceOperationalAccountId",
        "destinationOperationalAccountId",
      ],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("destinationOperationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("sourceOperationalAccountId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING,
      postingCode: POSTING_CODE.TRANSFER_INTRA_PENDING,
      transferCode: TRANSFER_CODE.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceOperationalAccountId",
        "destinationOperationalAccountId",
      ],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("destinationOperationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("sourceOperationalAccountId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE,
      transferCode: TRANSFER_CODE.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceOperationalAccountId",
        "destinationCounterpartyId",
      ],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.INTERCOMPANY),
          counterpartyId: dimension("destinationCounterpartyId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("sourceOperationalAccountId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_PENDING,
      postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING,
      transferCode: TRANSFER_CODE.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceOperationalAccountId",
        "destinationCounterpartyId",
      ],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.INTERCOMPANY),
          counterpartyId: dimension("destinationCounterpartyId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("sourceOperationalAccountId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
      transferCode: TRANSFER_CODE.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "destinationOperationalAccountId",
        "sourceCounterpartyId",
      ],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("destinationOperationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.INTERCOMPANY),
          counterpartyId: dimension("sourceCounterpartyId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_PENDING,
      postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_PENDING,
      transferCode: TRANSFER_CODE.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "destinationOperationalAccountId",
        "sourceCounterpartyId",
      ],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("destinationOperationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.INTERCOMPANY),
          counterpartyId: dimension("sourceCounterpartyId"),
        },
      },
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE,
      lineType: "post_pending",
      allowModules: ["transfer_settle"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: [
        "transferDocumentId",
        "eventIdempotencyKey",
        "pendingIndex",
      ],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID,
      lineType: "void_pending",
      allowModules: ["transfer_void"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: [
        "transferDocumentId",
        "eventIdempotencyKey",
        "pendingIndex",
      ],
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      transferCode: TRANSFER_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["operationalAccountId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FOUNDER_EQUITY,
        dimensions: {
          counterpartyId: dimension("counterpartyId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      transferCode: TRANSFER_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["operationalAccountId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.INVESTOR_EQUITY,
        dimensions: {
          counterpartyId: dimension("counterpartyId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      transferCode: TRANSFER_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["operationalAccountId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.SHAREHOLDER_LOAN,
        dimensions: {
          counterpartyId: dimension("counterpartyId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_OPENING_BALANCE,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
      transferCode: TRANSFER_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["operationalAccountId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
        dimensions: {},
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYIN_FUNDING,
      postingCode: POSTING_CODE.FUNDING_SETTLED,
      transferCode: TRANSFER_CODE.FUNDING_SETTLED,
      allowModules: ["payin_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["operationalAccountId", "customerId"],
      requiredRefs: ["paymentCaseId", "railRef"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
      postingCode: POSTING_CODE.FX_PRINCIPAL,
      transferCode: TRANSFER_CODE.FX_PRINCIPAL,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId"],
      requiredRefs: ["quoteRef", "chainId"],
      debit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.ORDER_RESERVE,
        dimensions: {
          orderId: dimension("orderId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_OUT,
      postingCode: POSTING_CODE.FX_LEG_OUT,
      transferCode: TRANSFER_CODE.FX_LEG_OUT,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "counterpartyId"],
      requiredRefs: ["quoteRef", "chainId", "legIndex"],
      debit: {
        accountNo: ACCOUNT_NO.ORDER_RESERVE,
        dimensions: {
          orderId: dimension("orderId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: dimension("orderId"),
          counterpartyId: dimension("counterpartyId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_LEG_IN,
      postingCode: POSTING_CODE.FX_LEG_IN,
      transferCode: TRANSFER_CODE.FX_LEG_IN,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "counterpartyId"],
      requiredRefs: ["quoteRef", "chainId", "legIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: dimension("orderId"),
          counterpartyId: dimension("counterpartyId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.ORDER_RESERVE,
        dimensions: {
          orderId: dimension("orderId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
      postingCode: POSTING_CODE.FEE_INCOME,
      transferCode: TRANSFER_CODE.FEE_INCOME,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_REVENUE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME,
      postingCode: POSTING_CODE.SPREAD_INCOME,
      transferCode: TRANSFER_CODE.SPREAD_INCOME,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.SPREAD_REVENUE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
      postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
      transferCode: TRANSFER_CODE.FEE_PASS_THROUGH_RESERVE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE,
      postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL,
      transferCode: TRANSFER_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "feeBucket", "counterpartyId"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
          counterpartyId: dimension("counterpartyId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE,
      postingCode: POSTING_CODE.ADJUSTMENT_CHARGE,
      transferCode: TRANSFER_CODE.ADJUSTMENT_CHARGE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.ADJUSTMENT_REVENUE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
      postingCode: POSTING_CODE.ADJUSTMENT_REFUND,
      transferCode: TRANSFER_CODE.ADJUSTMENT_REFUND,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_RESERVE,
      postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
      transferCode: TRANSFER_CODE.FEE_PASS_THROUGH_RESERVE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
        dimensions: {
          customerId: dimension("customerId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE,
      postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
      transferCode: TRANSFER_CODE.FEE_PASS_THROUGH_RESERVE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_PAYOUT_OBLIGATION,
      postingCode: POSTING_CODE.FX_PAYOUT_OBLIGATION,
      transferCode: TRANSFER_CODE.FX_PAYOUT_OBLIGATION,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId"],
      requiredRefs: ["quoteRef", "chainId", "payoutCounterpartyId"],
      debit: {
        accountNo: ACCOUNT_NO.ORDER_RESERVE,
        dimensions: {
          orderId: dimension("orderId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
        dimensions: {
          orderId: dimension("orderId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_INITIATE,
      postingCode: POSTING_CODE.PAYOUT_INITIATED,
      transferCode: TRANSFER_CODE.PAYOUT_INITIATED,
      allowModules: ["payout_initiate"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "operationalAccountId"],
      requiredRefs: ["railRef", "payoutBankStableKey"],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
        dimensions: {
          orderId: dimension("orderId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE,
      lineType: "post_pending",
      allowModules: ["payout_settle"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["orderId", "railRef"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
      lineType: "void_pending",
      allowModules: ["payout_void"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["orderId", "railRef"],
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_INITIATE,
      postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED,
      transferCode: TRANSFER_CODE.FEE_PAYMENT_INITIATED,
      allowModules: ["fee_payout_initiate"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "feeBucket",
        "orderId",
        "counterpartyId",
        "operationalAccountId",
      ],
      requiredRefs: ["componentId", "railRef"],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          feeBucket: dimension("feeBucket"),
          orderId: dimension("orderId"),
          counterpartyId: dimension("counterpartyId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          operationalAccountId: dimension("operationalAccountId"),
        },
      },
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_SETTLE,
      lineType: "post_pending",
      allowModules: ["fee_payout_settle"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["feePayoutInitiateDocumentId", "railRef"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_VOID,
      lineType: "void_pending",
      allowModules: ["fee_payout_void"],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["feePayoutInitiateDocumentId", "railRef"],
    }),
  ],
}) as AccountingPackDefinition;
