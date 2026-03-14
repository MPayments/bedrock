import {
  ACCOUNT_NO,
  CLEARING_KIND,
  POSTING_CODE,
  TransferCodes,
} from "../constants";
import {
  ACCOUNTING_SOURCE_ID,
  POSTING_TEMPLATE_KEY,
} from "../posting-contracts";
import {
  AccountingPackDefinitionSchema,
  type AccountingPackDefinition,
  type CreatePostingTemplateDefinition,
  type PendingPostingTemplateDefinition,
  type ValueBinding,
} from "./schema";

const BOOK_REF_BOOK_ID = "bookId";

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
  version: 3,
  templates: [
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_INTRA,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
        "destinationRequisiteId",
      ],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("destinationRequisiteId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("sourceRequisiteId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING,
      postingCode: POSTING_CODE.TRANSFER_INTRA_PENDING,
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_INTRA,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
        "destinationRequisiteId",
      ],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("destinationRequisiteId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("sourceRequisiteId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_IMMEDIATE,
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_INTERCOMPANY,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
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
          organizationRequisiteId: dimension("sourceRequisiteId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_PENDING,
      postingCode: POSTING_CODE.TRANSFER_CROSS_SOURCE_PENDING,
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_INTERCOMPANY,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
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
          organizationRequisiteId: dimension("sourceRequisiteId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_CROSS_DEST_IMMEDIATE,
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_INTERCOMPANY,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "destinationRequisiteId",
        "sourceCounterpartyId",
      ],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("destinationRequisiteId"),
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
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_INTERCOMPANY,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "destinationRequisiteId",
        "sourceCounterpartyId",
      ],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("destinationRequisiteId"),
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
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_SETTLE,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
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
      allowSources: [
        ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_VOID,
        ACCOUNTING_SOURCE_ID.PAYMENT_CASE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: [
        "transferDocumentId",
        "eventIdempotencyKey",
        "pendingIndex",
      ],
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_IMMEDIATE,
      postingCode: POSTING_CODE.TREASURY_FX_SOURCE_IMMEDIATE,
      transferCode: TransferCodes.TREASURY_FX_SOURCE_IMMEDIATE,
      allowSources: [ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
        "destinationRequisiteId",
        "sourceOrganizationId",
        "destinationOrganizationId",
      ],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("sourceRequisiteId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_PENDING,
      postingCode: POSTING_CODE.TREASURY_FX_SOURCE_PENDING,
      transferCode: TransferCodes.TREASURY_FX_SOURCE_PENDING,
      allowSources: [ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
        "destinationRequisiteId",
        "sourceOrganizationId",
        "destinationOrganizationId",
      ],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId"],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("sourceRequisiteId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_IMMEDIATE,
      postingCode: POSTING_CODE.TREASURY_FX_DESTINATION_IMMEDIATE,
      transferCode: TransferCodes.TREASURY_FX_DESTINATION_IMMEDIATE,
      allowSources: [ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
        "destinationRequisiteId",
        "sourceOrganizationId",
        "destinationOrganizationId",
      ],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("destinationRequisiteId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_PENDING,
      postingCode: POSTING_CODE.TREASURY_FX_DESTINATION_PENDING,
      transferCode: TransferCodes.TREASURY_FX_DESTINATION_PENDING,
      allowSources: [ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "sourceRequisiteId",
        "destinationRequisiteId",
        "sourceOrganizationId",
        "destinationOrganizationId",
      ],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId"],
      pendingMode: "required",
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("destinationRequisiteId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_SETTLE,
      lineType: "post_pending",
      allowSources: [ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["fxExecuteDocumentId", "eventIdempotencyKey"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_VOID,
      lineType: "void_pending",
      allowSources: [ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_VOID],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["fxExecuteDocumentId", "eventIdempotencyKey"],
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_FEE_INCOME,
      postingCode: POSTING_CODE.TREASURY_FX_FEE_INCOME,
      transferCode: TransferCodes.TREASURY_FX_FEE_INCOME,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_REVENUE,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_SPREAD_INCOME,
      postingCode: POSTING_CODE.TREASURY_FX_SPREAD_INCOME,
      transferCode: TransferCodes.TREASURY_FX_SPREAD_INCOME,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.SPREAD_REVENUE,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_PASS_THROUGH,
      postingCode: POSTING_CODE.TREASURY_FX_PASS_THROUGH,
      transferCode: TransferCodes.TREASURY_FX_PASS_THROUGH,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_PASS_THROUGH_REVERSAL,
      postingCode: POSTING_CODE.TREASURY_FX_PASS_THROUGH,
      transferCode: TransferCodes.TREASURY_FX_PASS_THROUGH,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_PROVIDER_FEE_EXPENSE,
      postingCode: POSTING_CODE.TREASURY_FX_PROVIDER_FEE_EXPENSE,
      transferCode: TransferCodes.TREASURY_FX_PROVIDER_FEE_EXPENSE,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_PROVIDER_FEE_EXPENSE_REVERSAL,
      postingCode: POSTING_CODE.TREASURY_FX_PROVIDER_FEE_EXPENSE,
      transferCode: TransferCodes.TREASURY_FX_PROVIDER_FEE_EXPENSE,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_ADJUSTMENT_CHARGE,
      postingCode: POSTING_CODE.TREASURY_FX_ADJUSTMENT_CHARGE,
      transferCode: TransferCodes.TREASURY_FX_ADJUSTMENT_CHARGE,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.ADJUSTMENT_REVENUE,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TREASURY_FX_ADJUSTMENT_REFUND,
      postingCode: POSTING_CODE.TREASURY_FX_ADJUSTMENT_REFUND,
      transferCode: TransferCodes.TREASURY_FX_ADJUSTMENT_REFUND,
      allowSources: [
        ACCOUNTING_SOURCE_ID.TREASURY_FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.TREASURY_FX_RESOLUTION_SETTLE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["feeBucket"],
      requiredRefs: ["fxExecuteDocumentId", "quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.ADJUSTMENT_EXPENSE,
        dimensions: {
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
          feeBucket: dimension("feeBucket"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.CLEARING,
        dimensions: {
          clearingKind: literal(CLEARING_KIND.TREASURY_FX),
          orderId: { kind: "ref", key: "fxExecuteDocumentId" },
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      transferCode: TransferCodes.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_OPENING_BALANCE,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
        dimensions: {},
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_FOUNDER_EQUITY,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      transferCode: TransferCodes.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      key: POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_INVESTOR_EQUITY,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      transferCode: TransferCodes.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      key: POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_SHAREHOLDER_LOAN,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      transferCode: TransferCodes.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "counterpartyId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      key: POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_OPENING_BALANCE,
      postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
      transferCode: TransferCodes.EXTERNAL_FUNDING_OPENING_BALANCE,
      allowSources: [ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId"],
      requiredRefs: ["entryRef", "kind"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      transferCode: TransferCodes.FUNDING_SETTLED,
      allowSources: [ACCOUNTING_SOURCE_ID.PAYIN_FUNDING],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["organizationRequisiteId", "customerId"],
      requiredRefs: ["paymentCaseId", "railRef"],
      debit: {
        accountNo: ACCOUNT_NO.BANK,
        dimensions: {
          organizationRequisiteId: dimension("organizationRequisiteId"),
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
      transferCode: TransferCodes.FX_PRINCIPAL,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ],
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
      transferCode: TransferCodes.FX_LEG_OUT,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
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
      transferCode: TransferCodes.FX_LEG_IN,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
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
      transferCode: TransferCodes.FEE_INCOME,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
        ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
      ],
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
      transferCode: TransferCodes.SPREAD_INCOME,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
        ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
      ],
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
      postingCode: POSTING_CODE.FEE_INCOME_FROM_RESERVE,
      transferCode: TransferCodes.FEE_INCOME_FROM_RESERVE,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_SPREAD_INCOME_FROM_RESERVE,
      postingCode: POSTING_CODE.SPREAD_INCOME_FROM_RESERVE,
      transferCode: TransferCodes.SPREAD_INCOME_FROM_RESERVE,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
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
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
        ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
      ],
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL,
      postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
        ACCOUNTING_SOURCE_ID.INVOICE_RESERVE,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["customerId", "orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE,
      postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL,
      transferCode: TransferCodes.PROVIDER_FEE_EXPENSE_ACCRUAL,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ],
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE_REVERSAL,
      postingCode: POSTING_CODE.PROVIDER_FEE_EXPENSE_ACCRUAL,
      transferCode: TransferCodes.PROVIDER_FEE_EXPENSE_ACCRUAL,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "feeBucket", "counterpartyId"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
        },
      },
      credit: {
        accountNo: ACCOUNT_NO.PROVIDER_FEE_EXPENSE,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
          counterpartyId: dimension("counterpartyId"),
        },
      },
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE,
      postingCode: POSTING_CODE.ADJUSTMENT_CHARGE,
      transferCode: TransferCodes.ADJUSTMENT_CHARGE,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ],
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
      transferCode: TransferCodes.ADJUSTMENT_REFUND,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ],
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_FROM_RESERVE,
      postingCode: POSTING_CODE.ADJUSTMENT_CHARGE_FROM_RESERVE,
      transferCode: TransferCodes.ADJUSTMENT_CHARGE_FROM_RESERVE,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "feeBucket"],
      requiredRefs: ["quoteRef", "chainId", "componentId", "componentIndex"],
      debit: {
        accountNo: ACCOUNT_NO.FEE_CLEARING,
        dimensions: {
          orderId: dimension("orderId"),
          feeBucket: dimension("feeBucket"),
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
      key: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_RESERVE,
      postingCode: POSTING_CODE.FEE_PASS_THROUGH_RESERVE,
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
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
      postingCode: POSTING_CODE.ADJUSTMENT_REFUND_FROM_RESERVE,
      transferCode: TransferCodes.ADJUSTMENT_REFUND_FROM_RESERVE,
      allowSources: [ACCOUNTING_SOURCE_ID.FX_EXECUTE],
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
      transferCode: TransferCodes.FX_PAYOUT_OBLIGATION,
      allowSources: [
        ACCOUNTING_SOURCE_ID.FX_EXECUTE,
        ACCOUNTING_SOURCE_ID.INVOICE_DIRECT,
      ],
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
      transferCode: TransferCodes.PAYOUT_INITIATED,
      allowSources: [ACCOUNTING_SOURCE_ID.PAYOUT_INITIATE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: ["orderId", "organizationRequisiteId"],
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
          organizationRequisiteId: dimension("organizationRequisiteId"),
        },
      },
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE,
      lineType: "post_pending",
      allowSources: [ACCOUNTING_SOURCE_ID.PAYOUT_SETTLE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["orderId", "railRef"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
      lineType: "void_pending",
      allowSources: [ACCOUNTING_SOURCE_ID.PAYOUT_VOID],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["orderId", "railRef"],
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_INITIATE,
      postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED,
      transferCode: TransferCodes.FEE_PAYMENT_INITIATED,
      allowSources: [ACCOUNTING_SOURCE_ID.FEE_PAYOUT_INITIATE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [
        "feeBucket",
        "orderId",
        "counterpartyId",
        "organizationRequisiteId",
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
          organizationRequisiteId: dimension("organizationRequisiteId"),
        },
      },
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_SETTLE,
      lineType: "post_pending",
      allowSources: [ACCOUNTING_SOURCE_ID.FEE_PAYOUT_SETTLE],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["feePayoutInitiateDocumentId", "railRef"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_VOID,
      lineType: "void_pending",
      allowSources: [ACCOUNTING_SOURCE_ID.FEE_PAYOUT_VOID],
      requiredBookRefs: [BOOK_REF_BOOK_ID],
      requiredDimensions: [],
      requiredRefs: ["feePayoutInitiateDocumentId", "railRef"],
    }),
  ],
}) as AccountingPackDefinition;
