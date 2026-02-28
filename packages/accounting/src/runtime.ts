import { and, desc, eq, lte } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { canonicalJson, makePlanKey, sha256Hex } from "@bedrock/kernel";
import { SYSTEM_LEDGER_ORG_ID, TransferCodes } from "@bedrock/kernel/constants";

import { ACCOUNT_NO, CLEARING_KIND, POSTING_CODE } from "./constants";
import {
  AccountingPackCompilationError,
  AccountingPackNotFoundError,
  AccountingPostingPlanValidationError,
  AccountingTemplateAccessError,
  UnknownPostingTemplateError,
} from "./errors";
import { type AccountingServiceDeps } from "./internal/context";

const OPERATION_TRANSFER_TYPE = {
  CREATE: "create",
  POST_PENDING: "post_pending",
  VOID_PENDING: "void_pending",
} as const;

export interface CreateIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.CREATE;
  planRef: string;
  postingCode: string;
  debit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  credit: {
    accountNo: string;
    currency: string;
    dimensions: Record<string, string>;
  };
  amountMinor: bigint;
  code?: number;
  pending?: {
    timeoutSeconds: number;
    ref?: string | null;
  };
  chain?: string | null;
  memo?: string | null;
}

export interface PostPendingIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.POST_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  amount?: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export interface VoidPendingIntentLine {
  type: typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  planRef: string;
  currency: string;
  pendingId: bigint;
  code?: number;
  chain?: string | null;
  memo?: string | null;
}

export type IntentLine =
  | CreateIntentLine
  | PostPendingIntentLine
  | VoidPendingIntentLine;

export interface OperationIntent {
  source: {
    type: string;
    id: string;
  };
  operationCode: string;
  operationVersion?: number;
  payload?: unknown;
  idempotencyKey: string;
  postingDate: Date;
  bookOrgId: string;
  lines: IntentLine[];
}

type ValueBinding =
  | { kind: "literal"; value: string }
  | { kind: "dimension"; key: string }
  | { kind: "ref"; key: string }
  | { kind: "bookRef"; key: string };

interface AccountSideTemplateDefinition {
  accountNo: string;
  dimensions: Record<string, ValueBinding>;
}

interface CreatePostingTemplateDefinition {
  key: string;
  lineType: typeof OPERATION_TRANSFER_TYPE.CREATE;
  postingCode: string;
  transferCode?: number;
  allowModules: string[];
  requiredBookRefs: string[];
  requiredDimensions: string[];
  requiredRefs?: string[];
  pendingMode?: "allowed" | "required" | "forbidden";
  debit: AccountSideTemplateDefinition;
  credit: AccountSideTemplateDefinition;
}

interface PendingPostingTemplateDefinition {
  key: string;
  lineType:
    | typeof OPERATION_TRANSFER_TYPE.POST_PENDING
    | typeof OPERATION_TRANSFER_TYPE.VOID_PENDING;
  allowModules: string[];
  requiredBookRefs: string[];
  requiredDimensions: string[];
  requiredRefs?: string[];
}

export type RawPostingTemplateDefinition =
  | CreatePostingTemplateDefinition
  | PendingPostingTemplateDefinition;

export interface AccountingPackDefinition {
  packKey: string;
  version: number;
  templates: RawPostingTemplateDefinition[];
}

interface CompiledPackSerializable {
  packKey: string;
  version: number;
  templates: CompiledPostingTemplate[];
}

export type CompiledPostingTemplate =
  | (Omit<CreatePostingTemplateDefinition, "requiredRefs" | "pendingMode"> & {
      requiredRefs: string[];
      pendingMode: "allowed" | "required" | "forbidden";
    })
  | (Omit<PendingPostingTemplateDefinition, "requiredRefs"> & {
      requiredRefs: string[];
    });

export interface CompiledPack extends CompiledPackSerializable {
  checksum: string;
  templateLookup: Map<string, CompiledPostingTemplate>;
}

export interface PackValidationResult {
  ok: boolean;
  errors: string[];
}

export interface DocumentPostingPlanRequest {
  templateKey: string;
  effectiveAt: Date;
  currency: string;
  amountMinor: bigint;
  bookRefs: Record<string, string>;
  dimensions: Record<string, string>;
  refs?: Record<string, string> | null;
  pending?: {
    ref?: string | null;
    pendingId?: bigint;
    timeoutSeconds?: number;
    amountMinor?: bigint;
  } | null;
  memo?: string | null;
}

export interface DocumentPostingPlan {
  operationCode: string;
  operationVersion?: number;
  payload: Record<string, unknown>;
  requests: DocumentPostingPlanRequest[];
}

export interface ResolvedPostingTemplate {
  requestIndex: number;
  templateKey: string;
  lineType: CompiledPostingTemplate["lineType"];
  postingCode: string | null;
}

export interface ResolvePostingPlanResult {
  intent: OperationIntent;
  packChecksum: string;
  postingPlanChecksum: string;
  journalIntentChecksum: string;
  appliedTemplates: ResolvedPostingTemplate[];
}

export interface ResolvePostingPlanInput {
  moduleId: string;
  source: OperationIntent["source"];
  idempotencyKey: string;
  postingDate: Date;
  at?: Date;
  bookIdContext?: string;
  plan: DocumentPostingPlan;
  pack?: CompiledPack;
}

export interface AccountingRuntime {
  compilePack: (definition: AccountingPackDefinition) => CompiledPack;
  getDefaultCompiledPack: () => CompiledPack;
  activatePackForScope: (input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) => Promise<{
    packChecksum: string;
    scopeId: string;
    scopeType: string;
    effectiveAt: Date;
  }>;
  loadActiveCompiledPackForBook: (input?: {
    bookId?: string;
    at?: Date;
  }) => Promise<CompiledPack>;
  storeCompiledPackVersion: (input: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) => Promise<CompiledPack>;
  resolvePostingPlan: (
    input: ResolvePostingPlanInput,
  ) => Promise<ResolvePostingPlanResult>;
  validatePackDefinition: (
    definition: AccountingPackDefinition,
  ) => PackValidationResult;
}

export const POSTING_TEMPLATE_KEY = {
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

export type PostingTemplateKey =
  (typeof POSTING_TEMPLATE_KEY)[keyof typeof POSTING_TEMPLATE_KEY];

const BOOK_REF_BOOK_ORG_ID = "bookOrgId";
const PACK_CACHE_TTL_MS = 60_000;
const PACK_SCOPE_TYPE_BOOK = "book";

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
    lineType: OPERATION_TRANSFER_TYPE.CREATE,
    ...definition,
  };
}

function pendingTemplate(
  definition: PendingPostingTemplateDefinition,
): PendingPostingTemplateDefinition {
  return definition;
}

export const DEFAULT_ACCOUNTING_PACK_DEFINITION: AccountingPackDefinition = {
  packKey: "bedrock-core-default",
  version: 1,
  templates: [
    createTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
      postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.INTERNAL_TRANSFER,
      allowModules: ["transfer"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      lineType: OPERATION_TRANSFER_TYPE.POST_PENDING,
      allowModules: ["transfer_settle"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
      requiredDimensions: [],
      requiredRefs: [
        "transferDocumentId",
        "eventIdempotencyKey",
        "pendingIndex",
      ],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID,
      lineType: OPERATION_TRANSFER_TYPE.VOID_PENDING,
      allowModules: ["transfer_void"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_FOUNDER_EQUITY,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_INVESTOR_EQUITY,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.EXTERNAL_FUNDING_OPENING_BALANCE,
      allowModules: ["external_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.FUNDING_SETTLED,
      allowModules: ["payin_funding"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.FX_PRINCIPAL,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.PROVIDER_FEE_EXPENSE_ACCRUAL,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.ADJUSTMENT_CHARGE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      transferCode: TransferCodes.FEE_PASS_THROUGH_RESERVE,
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["fx_execute"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      allowModules: ["payout_initiate"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      lineType: OPERATION_TRANSFER_TYPE.POST_PENDING,
      allowModules: ["payout_settle"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
      requiredDimensions: [],
      requiredRefs: ["orderId", "railRef"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
      lineType: OPERATION_TRANSFER_TYPE.VOID_PENDING,
      allowModules: ["payout_void"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
      requiredDimensions: [],
      requiredRefs: ["orderId", "railRef"],
    }),
    createTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_INITIATE,
      postingCode: POSTING_CODE.FEE_PAYMENT_INITIATED,
      transferCode: TransferCodes.FEE_PAYMENT_INITIATED,
      allowModules: ["fee_payout_initiate"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
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
      lineType: OPERATION_TRANSFER_TYPE.POST_PENDING,
      allowModules: ["fee_payout_settle"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
      requiredDimensions: [],
      requiredRefs: ["feePayoutInitiateDocumentId", "railRef"],
    }),
    pendingTemplate({
      key: POSTING_TEMPLATE_KEY.PAYMENT_FEE_PAYOUT_VOID,
      lineType: OPERATION_TRANSFER_TYPE.VOID_PENDING,
      allowModules: ["fee_payout_void"],
      requiredBookRefs: [BOOK_REF_BOOK_ORG_ID],
      requiredDimensions: [],
      requiredRefs: ["feePayoutInitiateDocumentId", "railRef"],
    }),
  ],
};

const DEFAULT_COMPILED_PACK = compilePack(DEFAULT_ACCOUNTING_PACK_DEFINITION);

interface CachedPackEntry {
  expiresAt: number;
  value: CompiledPack | null;
}

function serializeCompiledPack(
  pack: CompiledPack,
): CompiledPackSerializable & { checksum: string } {
  return {
    packKey: pack.packKey,
    version: pack.version,
    checksum: pack.checksum,
    templates: pack.templates,
  };
}

function hydrateCompiledPack(
  compiledJson: Record<string, unknown>,
  checksumHint?: string,
): CompiledPack {
  const packKey = String(compiledJson.packKey);
  const version = Number(compiledJson.version);
  const templates = (compiledJson.templates ?? []) as CompiledPostingTemplate[];
  const serializable: CompiledPackSerializable = {
    packKey,
    version,
    templates,
  };
  const checksum = sha256Hex(canonicalJson(serializable));

  if (checksumHint && checksum !== checksumHint) {
    throw new AccountingPackCompilationError([
      `Compiled pack checksum mismatch for ${packKey}@${version}`,
    ]);
  }

  return {
    ...serializable,
    checksum,
    templateLookup: new Map(
      templates.map((template) => [template.key, template]),
    ),
  };
}

function isCreateTemplateDefinition(
  template: RawPostingTemplateDefinition,
): template is CreatePostingTemplateDefinition {
  return template.lineType === OPERATION_TRANSFER_TYPE.CREATE;
}

function isCompiledCreateTemplate(
  template: CompiledPostingTemplate,
): template is Extract<CompiledPostingTemplate, { lineType: "create" }> {
  return template.lineType === OPERATION_TRANSFER_TYPE.CREATE;
}

function normalizeTemplate(
  template: RawPostingTemplateDefinition,
): CompiledPostingTemplate {
  if (isCreateTemplateDefinition(template)) {
    return {
      ...template,
      pendingMode: template.pendingMode ?? "forbidden",
      requiredRefs: [...(template.requiredRefs ?? [])].sort(),
      requiredBookRefs: [...template.requiredBookRefs].sort(),
      requiredDimensions: [...template.requiredDimensions].sort(),
      allowModules: [...template.allowModules].sort(),
      debit: {
        accountNo: template.debit.accountNo,
        dimensions: sortRecord(template.debit.dimensions),
      },
      credit: {
        accountNo: template.credit.accountNo,
        dimensions: sortRecord(template.credit.dimensions),
      },
    };
  }

  return {
    ...template,
    requiredRefs: [...(template.requiredRefs ?? [])].sort(),
    requiredBookRefs: [...template.requiredBookRefs].sort(),
    requiredDimensions: [...template.requiredDimensions].sort(),
    allowModules: [...template.allowModules].sort(),
  };
}

function sortRecord<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  ) as Record<string, T>;
}

function validateBindings(
  template: RawPostingTemplateDefinition,
  errors: string[],
) {
  if (!isCreateTemplateDefinition(template)) {
    return;
  }

  for (const [side, dimensions] of [
    ["debit", template.debit.dimensions],
    ["credit", template.credit.dimensions],
  ] as const) {
    for (const [dimensionKey, binding] of Object.entries(dimensions) as [
      string,
      ValueBinding,
    ][]) {
      if (binding.kind === "dimension") {
        if (!template.requiredDimensions.includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared dimension "${binding.key}"`,
          );
        }
      }
      if (binding.kind === "ref") {
        if (!(template.requiredRefs ?? []).includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared ref "${binding.key}"`,
          );
        }
      }
      if (binding.kind === "bookRef") {
        if (!template.requiredBookRefs.includes(binding.key)) {
          errors.push(
            `${template.key}: ${side}.${dimensionKey} references undeclared bookRef "${binding.key}"`,
          );
        }
      }
    }
  }
}

export function validatePackDefinition(
  definition: AccountingPackDefinition,
): PackValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!definition.packKey.trim()) {
    errors.push("packKey must be non-empty");
  }

  if (!Number.isInteger(definition.version) || definition.version <= 0) {
    errors.push("version must be a positive integer");
  }

  for (const template of definition.templates) {
    if (seen.has(template.key)) {
      errors.push(`duplicate template key: ${template.key}`);
      continue;
    }
    seen.add(template.key);

    if (template.allowModules.length === 0) {
      errors.push(`${template.key}: allowModules must be non-empty`);
    }
    if (template.requiredBookRefs.length === 0) {
      errors.push(`${template.key}: requiredBookRefs must be non-empty`);
    }

    validateBindings(template, errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function compilePack(
  definition: AccountingPackDefinition,
): CompiledPack {
  const validation = validatePackDefinition(definition);
  if (!validation.ok) {
    throw new AccountingPackCompilationError(validation.errors);
  }

  const templates = [...definition.templates]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((template) => normalizeTemplate(template));

  const serializable: CompiledPackSerializable = {
    packKey: definition.packKey,
    version: definition.version,
    templates,
  };

  return {
    ...serializable,
    checksum: sha256Hex(canonicalJson(serializable)),
    templateLookup: new Map(
      templates.map((template) => [template.key, template]),
    ),
  };
}

function resolveBindingValue(
  request: DocumentPostingPlanRequest,
  binding: ValueBinding,
): string {
  if (binding.kind === "literal") {
    return binding.value;
  }

  if (binding.kind === "dimension") {
    const value = request.dimensions[binding.key];
    if (!value) {
      throw new AccountingPostingPlanValidationError(
        `Missing dimension "${binding.key}" for template ${request.templateKey}`,
      );
    }
    return value;
  }

  if (binding.kind === "ref") {
    const value = request.refs?.[binding.key];
    if (!value) {
      throw new AccountingPostingPlanValidationError(
        `Missing ref "${binding.key}" for template ${request.templateKey}`,
      );
    }
    return value;
  }

  const value = request.bookRefs[binding.key];
  if (!value) {
    throw new AccountingPostingPlanValidationError(
      `Missing bookRef "${binding.key}" for template ${request.templateKey}`,
    );
  }
  return value;
}

function buildPlanRef(request: DocumentPostingPlanRequest): string {
  return makePlanKey(request.templateKey, {
    amountMinor: request.amountMinor,
    bookRefs: request.bookRefs,
    currency: request.currency,
    dimensions: request.dimensions,
    effectiveAt: request.effectiveAt,
    pending: request.pending ?? null,
    refs: request.refs ?? null,
  });
}

function validateRequestShape(
  request: DocumentPostingPlanRequest,
  template: CompiledPostingTemplate,
) {
  for (const key of template.requiredBookRefs) {
    if (!request.bookRefs[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires bookRef "${key}"`,
      );
    }
  }

  for (const key of template.requiredDimensions) {
    if (!request.dimensions[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires dimension "${key}"`,
      );
    }
  }

  for (const key of template.requiredRefs) {
    if (!request.refs?.[key]) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires ref "${key}"`,
      );
    }
  }

  if (isCompiledCreateTemplate(template)) {
    if (request.amountMinor <= 0n) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} requires amountMinor > 0`,
      );
    }

    if (template.pendingMode === "required") {
      if (!request.pending?.timeoutSeconds) {
        throw new AccountingPostingPlanValidationError(
          `Template ${template.key} requires pending.timeoutSeconds`,
        );
      }
    }

    if (template.pendingMode === "forbidden" && request.pending) {
      throw new AccountingPostingPlanValidationError(
        `Template ${template.key} does not allow pending config`,
      );
    }

    return;
  }

  if (!request.pending?.pendingId || request.pending.pendingId <= 0n) {
    throw new AccountingPostingPlanValidationError(
      `Template ${template.key} requires pending.pendingId`,
    );
  }
}

function resolveCreateLine(
  request: DocumentPostingPlanRequest,
  template: Extract<CompiledPostingTemplate, { lineType: "create" }>,
): CreateIntentLine {
  return {
    type: OPERATION_TRANSFER_TYPE.CREATE,
    planRef: buildPlanRef(request),
    postingCode: template.postingCode,
    debit: {
      accountNo: template.debit.accountNo,
      currency: request.currency,
      dimensions: Object.fromEntries(
        (
          Object.entries(template.debit.dimensions) as [string, ValueBinding][]
        ).map(([key, binding]) => [key, resolveBindingValue(request, binding)]),
      ),
    },
    credit: {
      accountNo: template.credit.accountNo,
      currency: request.currency,
      dimensions: Object.fromEntries(
        (
          Object.entries(template.credit.dimensions) as [string, ValueBinding][]
        ).map(([key, binding]) => [key, resolveBindingValue(request, binding)]),
      ),
    },
    amountMinor: request.amountMinor,
    code: template.transferCode,
    pending: request.pending
      ? {
          timeoutSeconds: request.pending.timeoutSeconds!,
          ref: request.pending.ref ?? null,
        }
      : undefined,
    chain: request.refs?.chainId ?? null,
    memo: request.memo ?? null,
  };
}

function resolvePendingLine(
  request: DocumentPostingPlanRequest,
  template: Extract<
    CompiledPostingTemplate,
    { lineType: "post_pending" | "void_pending" }
  >,
): PostPendingIntentLine | VoidPendingIntentLine {
  const base = {
    planRef: buildPlanRef(request),
    currency: request.currency,
    pendingId: request.pending!.pendingId!,
    code: undefined,
    chain: request.refs?.chainId ?? null,
    memo: request.memo ?? null,
  };

  if (template.lineType === OPERATION_TRANSFER_TYPE.POST_PENDING) {
    return {
      type: OPERATION_TRANSFER_TYPE.POST_PENDING,
      ...base,
      amount: request.pending?.amountMinor ?? 0n,
    };
  }

  return {
    type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
    ...base,
  };
}

async function resolvePostingPlanInternal(
  input: ResolvePostingPlanInput,
  compiledPack: CompiledPack,
): Promise<ResolvePostingPlanResult> {
  const { moduleId, plan } = input;
  const lines: IntentLine[] = [];
  const appliedTemplates: ResolvedPostingTemplate[] = [];
  let resolvedBookOrgId: string | null = null;

  for (const [requestIndex, request] of plan.requests.entries()) {
    const template = compiledPack.templateLookup.get(request.templateKey);
    if (!template) {
      throw new UnknownPostingTemplateError(request.templateKey);
    }

    if (!template.allowModules.includes(moduleId)) {
      throw new AccountingTemplateAccessError(moduleId, template.key);
    }

    validateRequestShape(request, template);

    const requestBookOrgId = request.bookRefs[BOOK_REF_BOOK_ORG_ID];
    if (requestBookOrgId) {
      if (resolvedBookOrgId && resolvedBookOrgId !== requestBookOrgId) {
        throw new AccountingPostingPlanValidationError(
          "All requests must resolve to the same bookOrgId until multi-book ledger support is implemented",
        );
      }
      resolvedBookOrgId = requestBookOrgId;
    }

    const line = isCompiledCreateTemplate(template)
      ? resolveCreateLine(request, template)
      : resolvePendingLine(request, template);

    lines.push(line);
    appliedTemplates.push({
      requestIndex,
      templateKey: template.key,
      lineType: template.lineType,
      postingCode: isCompiledCreateTemplate(template)
        ? template.postingCode
        : null,
    });
  }

  const intent: OperationIntent = {
    source: input.source,
    operationCode: plan.operationCode,
    operationVersion: plan.operationVersion ?? 1,
    payload: plan.payload,
    idempotencyKey: input.idempotencyKey,
    postingDate: input.postingDate,
    bookOrgId: resolvedBookOrgId ?? SYSTEM_LEDGER_ORG_ID,
    lines,
  };

  return {
    intent,
    packChecksum: compiledPack.checksum,
    postingPlanChecksum: sha256Hex(canonicalJson(plan)),
    journalIntentChecksum: sha256Hex(canonicalJson(intent)),
    appliedTemplates,
  };
}

export function createAccountingRuntime(
  deps: AccountingServiceDeps,
): AccountingRuntime {
  const { db } = deps;
  const packCache = new Map<string, CachedPackEntry>();

  function readCachedPack(key: string) {
    const cached = packCache.get(key);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt < Date.now()) {
      packCache.delete(key);
      return undefined;
    }

    return cached.value;
  }

  function writeCachedPack(key: string, value: CompiledPack | null) {
    packCache.set(key, {
      value,
      expiresAt: Date.now() + PACK_CACHE_TTL_MS,
    });
  }

  async function storeCompiledPackVersion(input: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) {
    const compiled =
      input.pack ??
      (input.definition
        ? compilePack(input.definition)
        : DEFAULT_COMPILED_PACK);

    await db
      .insert(schema.accountingPackVersions)
      .values({
        packKey: compiled.packKey,
        version: compiled.version,
        checksum: compiled.checksum,
        compiledJson: serializeCompiledPack(compiled) as unknown as Record<
          string,
          unknown
        >,
      })
      .onConflictDoNothing();

    writeCachedPack(compiled.checksum, compiled);
    return compiled;
  }

  async function loadCompiledPackByChecksum(checksum: string) {
    const cached = readCachedPack(checksum);
    if (typeof cached !== "undefined") {
      return cached;
    }

    const [row] = await db
      .select({
        checksum: schema.accountingPackVersions.checksum,
        compiledJson: schema.accountingPackVersions.compiledJson,
      })
      .from(schema.accountingPackVersions)
      .where(eq(schema.accountingPackVersions.checksum, checksum))
      .limit(1);

    if (!row) {
      writeCachedPack(checksum, null);
      return null;
    }

    const pack = hydrateCompiledPack(
      row.compiledJson as Record<string, unknown>,
      row.checksum,
    );
    writeCachedPack(checksum, pack);
    return pack;
  }

  async function activatePackForScope(input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) {
    const pack = await loadCompiledPackByChecksum(input.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(input.packChecksum);
    }

    const scopeType = input.scopeType ?? PACK_SCOPE_TYPE_BOOK;
    const effectiveAt = input.effectiveAt ?? new Date();

    await db.insert(schema.accountingPackAssignments).values({
      scopeType,
      scopeId: input.scopeId,
      packChecksum: input.packChecksum,
      effectiveAt,
    });

    writeCachedPack(
      `scope:${scopeType}:${input.scopeId}:${effectiveAt.toISOString()}`,
      pack,
    );

    return {
      packChecksum: input.packChecksum,
      scopeId: input.scopeId,
      scopeType,
      effectiveAt,
    };
  }

  async function loadActiveCompiledPackForBook(input?: {
    bookId?: string;
    at?: Date;
  }) {
    if (!input?.bookId) {
      return DEFAULT_COMPILED_PACK;
    }

    const at = input.at ?? new Date();
    const scopeCacheKey = `scope:${PACK_SCOPE_TYPE_BOOK}:${input.bookId}:${at.toISOString()}`;
    const cached = readCachedPack(scopeCacheKey);
    if (typeof cached !== "undefined" && cached) {
      return cached;
    }

    const [assignment] = await db
      .select({
        packChecksum: schema.accountingPackAssignments.packChecksum,
      })
      .from(schema.accountingPackAssignments)
      .where(
        and(
          eq(schema.accountingPackAssignments.scopeType, PACK_SCOPE_TYPE_BOOK),
          eq(schema.accountingPackAssignments.scopeId, input.bookId),
          lte(schema.accountingPackAssignments.effectiveAt, at),
        ),
      )
      .orderBy(desc(schema.accountingPackAssignments.effectiveAt))
      .limit(1);

    if (!assignment) {
      writeCachedPack(scopeCacheKey, DEFAULT_COMPILED_PACK);
      return DEFAULT_COMPILED_PACK;
    }

    const pack = await loadCompiledPackByChecksum(assignment.packChecksum);
    if (!pack) {
      throw new AccountingPackNotFoundError(assignment.packChecksum);
    }

    writeCachedPack(scopeCacheKey, pack);
    return pack;
  }

  async function resolvePostingPlan(input: ResolvePostingPlanInput) {
    const pack =
      input.pack ??
      (await loadActiveCompiledPackForBook({
        bookId:
          input.bookIdContext ??
          input.plan.requests[0]?.bookRefs[BOOK_REF_BOOK_ORG_ID],
        at: input.at ?? input.postingDate,
      }));
    return resolvePostingPlanInternal(input, pack);
  }

  return {
    compilePack,
    activatePackForScope,
    getDefaultCompiledPack: () => DEFAULT_COMPILED_PACK,
    loadActiveCompiledPackForBook,
    storeCompiledPackVersion,
    resolvePostingPlan,
    validatePackDefinition,
  };
}
