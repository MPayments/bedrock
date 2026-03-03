import { and, asc, eq, inArray } from "drizzle-orm";

import type { DocumentModule } from "@bedrock/core/documents";
import {
  DocumentValidationError,
} from "@bedrock/core/documents";
import {
  buildDocumentDraft,
  buildDocumentPostIdempotencyKey,
  buildDocumentPostingPlan,
  buildDocumentPostingRequest,
  parseDocumentPayload,
  serializeOccurredAt,
} from "@bedrock/core/documents/module-kit";
import { schema as documentsSchema } from "@bedrock/core/documents/schema";
import { schema as ledgerSchema } from "@bedrock/core/ledger/schema";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/kernel/accounting-contracts";

import {
  AccrualAdjustmentSchema,
  CapitalFundingInputSchema,
  CapitalFundingPayloadSchema,
  ClosingReclassSchema,
  EquityContributionSchema,
  EquityDistributionSchema,
  ImpairmentAdjustmentSchema,
  IntercompanyInterestAccrualSchema,
  IntercompanyInterestSettlementSchema,
  IntercompanyLoanDrawdownSchema,
  IntercompanyLoanRepaymentSchema,
  PeriodCloseSchema,
  PeriodReopenSchema,
  RevaluationAdjustmentSchema,
  TransferIntercompanyInputSchema,
  TransferIntercompanyPayloadSchema,
  TransferIntraInputSchema,
  TransferIntraPayloadSchema,
  TransferResolutionInputSchema,
  TransferResolutionPayloadSchema,
  type CapitalFundingInput,
  type TransferIntercompanyInput,
  type TransferIntercompanyPayload,
  type TransferIntraInput,
  type TransferIntraPayload,
  type TransferResolutionInput,
} from "./validation";

const schema = {
  ...documentsSchema,
  ...ledgerSchema,
};

const TRANSFER_DOC_TYPES = ["transfer_intra", "transfer_intercompany"] as const;

type IfrsDocType =
  | "transfer_intra"
  | "transfer_intercompany"
  | "transfer_resolution"
  | "capital_funding"
  | "intercompany_loan_drawdown"
  | "intercompany_loan_repayment"
  | "intercompany_interest_accrual"
  | "intercompany_interest_settlement"
  | "equity_contribution"
  | "equity_distribution"
  | "accrual_adjustment"
  | "revaluation_adjustment"
  | "impairment_adjustment"
  | "closing_reclass"
  | "period_close"
  | "period_reopen";

interface CounterpartyAccountBinding {
  accountId: string;
  bookId: string;
  counterpartyId: string;
  currencyCode: string;
  stableKey: string;
}

interface CounterpartyAccountsService {
  resolveTransferBindings(input: {
    accountIds: string[];
  }): Promise<CounterpartyAccountBinding[]>;
}

function toAmountMinor(value: unknown): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function firstString(
  input: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function normalizeTransferPayload(
  input: TransferIntraInput | TransferIntercompanyInput,
  bindings: {
    source: CounterpartyAccountBinding;
    destination: CounterpartyAccountBinding;
  },
): TransferIntraPayload | TransferIntercompanyPayload {
  return {
    ...serializeOccurredAt(input),
    sourceCounterpartyId: bindings.source.counterpartyId,
    destinationCounterpartyId: bindings.destination.counterpartyId,
    memo: input.memo,
  };
}

async function resolveTransferBindings(
  counterpartyAccountsService: CounterpartyAccountsService,
  input: {
    sourceCounterpartyAccountId: string;
    destinationCounterpartyAccountId: string;
  },
) {
  const [source, destination] =
    await counterpartyAccountsService.resolveTransferBindings({
      accountIds: [
        input.sourceCounterpartyAccountId,
        input.destinationCounterpartyAccountId,
      ],
    });

  if (!source || !destination) {
    throw new DocumentValidationError("Counterparty account binding is missing");
  }

  return { source, destination };
}

function ensureTransferCurrencies(input: {
  payloadCurrency: string;
  sourceCurrency: string;
  destinationCurrency: string;
}) {
  if (
    input.payloadCurrency !== input.sourceCurrency ||
    input.payloadCurrency !== input.destinationCurrency
  ) {
    throw new DocumentValidationError(
      `Currency mismatch: payload=${input.payloadCurrency}, source=${input.sourceCurrency}, destination=${input.destinationCurrency}`,
    );
  }
}

function resolvePendingTransferBookId(input: {
  sourceBookId: string;
  destinationBookId: string;
  pendingRef?: string | null;
}) {
  if (input.sourceBookId === input.destinationBookId) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":source")) {
    return input.sourceBookId;
  }

  if (input.pendingRef?.endsWith(":destination")) {
    return input.destinationBookId;
  }

  throw new DocumentValidationError(
    `Pending transfer reference is ambiguous: ${input.pendingRef ?? "n/a"}`,
  );
}

async function resolveTransferDependencyDocument(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  transferDocumentId: string,
) {
  const [dependency] = await db
    .select({
      document: schema.documents,
    })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, transferDocumentId),
        inArray(schema.documents.docType, [...TRANSFER_DOC_TYPES]),
      ),
    )
    .limit(1);

  if (!dependency) {
    throw new DocumentValidationError(
      `Transfer document ${transferDocumentId} was not found`,
    );
  }

  return dependency.document;
}

async function listPendingTransfers(
  db: Parameters<DocumentModule["canPost"]>[0]["db"],
  transferDocumentId: string,
) {
  const rows = await db
    .select({
      transferId: schema.tbTransferPlans.transferId,
      pendingRef: schema.tbTransferPlans.pendingRef,
      amountMinor: schema.tbTransferPlans.amount,
    })
    .from(schema.documentOperations)
    .innerJoin(
      schema.tbTransferPlans,
      eq(schema.tbTransferPlans.operationId, schema.documentOperations.operationId),
    )
    .where(
      and(
        eq(schema.documentOperations.documentId, transferDocumentId),
        eq(schema.documentOperations.kind, "post"),
        eq(schema.tbTransferPlans.isPending, true),
      ),
    )
    .orderBy(asc(schema.tbTransferPlans.lineNo));

  if (rows.length === 0) {
    throw new DocumentValidationError(
      `Transfer document ${transferDocumentId} does not have pending transfers`,
    );
  }

  return rows;
}

function createSimpleIfrsDocumentModule<TPayload extends { occurredAt: Date }>(input: {
  docType: IfrsDocType;
  docNoPrefix: string;
  title: string;
  payloadSchema: DocumentModule<TPayload, TPayload>["payloadSchema"];
  createSchema: DocumentModule<TPayload, TPayload>["createSchema"];
  updateSchema: DocumentModule<TPayload, TPayload>["updateSchema"];
}): DocumentModule<TPayload, TPayload> {
  return {
    moduleId: input.docType,
    accountingSourceIds: [],
    docType: input.docType,
    docNoPrefix: input.docNoPrefix,
    payloadVersion: 1,
    createSchema: input.createSchema,
    updateSchema: input.updateSchema,
    payloadSchema: input.payloadSchema,
    postingRequired: false,
    approvalRequired: () => false,
    async createDraft(_context, payload) {
      return buildDocumentDraft(payload, serializeOccurredAt(payload));
    },
    async updateDraft(_context, _document, payload) {
      return buildDocumentDraft(payload, serializeOccurredAt(payload));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(input.payloadSchema, document) as Record<
        string,
        unknown
      >;

      return {
        title: input.title,
        amountMinor: toAmountMinor(payload.amountMinor),
        currency: typeof payload.currency === "string" ? payload.currency : null,
        memo: typeof payload.memo === "string" ? payload.memo : null,
        counterpartyId: firstString(payload, [
          "counterpartyId",
          "debtorCounterpartyId",
          "sourceCounterpartyId",
        ]),
        searchText: [
          document.docNo,
          document.docType,
          input.title,
          firstString(payload, [
            "counterpartyId",
            "debtorCounterpartyId",
            "creditorCounterpartyId",
            "reference",
          ]) ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}

export function createTransferIntraDocumentModule(deps: {
  counterpartyAccountsService: CounterpartyAccountsService;
}): DocumentModule<TransferIntraInput, TransferIntraInput> {
  const { counterpartyAccountsService } = deps;

  return {
    moduleId: "transfer_intra",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TRANSFER_INTRA,
    docType: "transfer_intra",
    docNoPrefix: "TRI",
    payloadVersion: 1,
    createSchema: TransferIntraInputSchema,
    updateSchema: TransferIntraInputSchema,
    payloadSchema: TransferIntraPayloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      if (bindings.source.counterpartyId !== bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intra requires source and destination accounts from the same counterparty",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    async updateDraft(_context, _document, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      if (bindings.source.counterpartyId !== bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intra requires source and destination accounts from the same counterparty",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferIntraPayloadSchema, document);

      return {
        title: "Intra-counterparty transfer",
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.sourceCounterpartyId,
        counterpartyAccountId: payload.sourceCounterpartyAccountId,
        searchText: [
          document.docNo,
          document.docType,
          payload.sourceCounterpartyAccountId,
          payload.destinationCounterpartyAccountId,
          payload.sourceCounterpartyId,
          payload.currency,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      ensureTransferCurrencies({
        payloadCurrency: input.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
      if (bindings.source.counterpartyId !== bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intra requires accounts from the same counterparty",
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(TransferIntraPayloadSchema, document);
      const bindings = await resolveTransferBindings(counterpartyAccountsService, payload);
      ensureTransferCurrencies({
        payloadCurrency: payload.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });

      if (bindings.source.bookId !== bindings.destination.bookId) {
        throw new DocumentValidationError(
          "transfer_intra requires both accounts in the same book",
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(TransferIntraPayloadSchema, document);
      const bindings = await resolveTransferBindings(counterpartyAccountsService, payload);

      if (bindings.source.bookId !== bindings.destination.bookId) {
        throw new DocumentValidationError(
          "transfer_intra requires both accounts in the same book",
        );
      }

      const isPending = Boolean(payload.timeoutSeconds);
      const templateKey = isPending
        ? POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING
        : POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE;
      const operationCode = isPending
        ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_INTRA
        : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_INTRA;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey,
            bookId: bindings.source.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
            },
            pending: isPending
              ? {
                  timeoutSeconds: payload.timeoutSeconds,
                  ref: `transfer:${document.id}`,
                }
              : null,
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}

export function createTransferIntercompanyDocumentModule(deps: {
  counterpartyAccountsService: CounterpartyAccountsService;
}): DocumentModule<TransferIntercompanyInput, TransferIntercompanyInput> {
  const { counterpartyAccountsService } = deps;

  return {
    moduleId: "transfer_intercompany",
    accountingSourceId: ACCOUNTING_SOURCE_ID.TRANSFER_INTERCOMPANY,
    docType: "transfer_intercompany",
    docNoPrefix: "TRX",
    payloadVersion: 1,
    createSchema: TransferIntercompanyInputSchema,
    updateSchema: TransferIntercompanyInputSchema,
    payloadSchema: TransferIntercompanyPayloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      if (bindings.source.counterpartyId === bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires source and destination from different counterparties",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    async updateDraft(_context, _document, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      if (bindings.source.counterpartyId === bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires source and destination from different counterparties",
        );
      }

      return buildDocumentDraft(input, normalizeTransferPayload(input, bindings));
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferIntercompanyPayloadSchema, document);

      return {
        title: "Intercompany transfer",
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.sourceCounterpartyId,
        counterpartyAccountId: payload.sourceCounterpartyAccountId,
        searchText: [
          document.docNo,
          document.docType,
          payload.sourceCounterpartyId,
          payload.destinationCounterpartyId,
          payload.sourceCounterpartyAccountId,
          payload.destinationCounterpartyAccountId,
          payload.currency,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const bindings = await resolveTransferBindings(counterpartyAccountsService, input);
      ensureTransferCurrencies({
        payloadCurrency: input.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
      if (bindings.source.counterpartyId === bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires accounts from different counterparties",
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(TransferIntercompanyPayloadSchema, document);
      const bindings = await resolveTransferBindings(counterpartyAccountsService, payload);
      ensureTransferCurrencies({
        payloadCurrency: payload.currency,
        sourceCurrency: bindings.source.currencyCode,
        destinationCurrency: bindings.destination.currencyCode,
      });
      if (bindings.source.counterpartyId === bindings.destination.counterpartyId) {
        throw new DocumentValidationError(
          "transfer_intercompany requires accounts from different counterparties",
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(TransferIntercompanyPayloadSchema, document);
      const bindings = await resolveTransferBindings(counterpartyAccountsService, payload);
      const isPending = Boolean(payload.timeoutSeconds);

      const sourceTemplateKey = isPending
        ? POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_PENDING
        : POSTING_TEMPLATE_KEY.TRANSFER_CROSS_SOURCE_IMMEDIATE;
      const destinationTemplateKey = isPending
        ? POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_PENDING
        : POSTING_TEMPLATE_KEY.TRANSFER_CROSS_DESTINATION_IMMEDIATE;
      const operationCode = isPending
        ? OPERATION_CODE.TRANSFER_APPROVE_PENDING_CROSS
        : OPERATION_CODE.TRANSFER_APPROVE_IMMEDIATE_CROSS;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey: sourceTemplateKey,
            bookId: bindings.source.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              sourceCounterpartyAccountId: payload.sourceCounterpartyAccountId,
              destinationCounterpartyId: payload.destinationCounterpartyId,
            },
            pending: isPending
              ? {
                  timeoutSeconds: payload.timeoutSeconds,
                  ref: `transfer:${document.id}:source`,
                }
              : null,
            memo: payload.memo ?? null,
          }),
          buildDocumentPostingRequest(document, {
            templateKey: destinationTemplateKey,
            bookId: bindings.destination.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              destinationCounterpartyAccountId:
                payload.destinationCounterpartyAccountId,
              sourceCounterpartyId: payload.sourceCounterpartyId,
            },
            pending: isPending
              ? {
                  timeoutSeconds: payload.timeoutSeconds,
                  ref: `transfer:${document.id}:destination`,
                }
              : null,
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}

export function createTransferResolutionDocumentModule(deps: {
  counterpartyAccountsService: CounterpartyAccountsService;
}): DocumentModule<TransferResolutionInput, TransferResolutionInput> {
  const { counterpartyAccountsService } = deps;

  return {
    moduleId: "transfer_resolution",
    accountingSourceIds: [
      ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_SETTLE,
      ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_VOID,
    ],
    docType: "transfer_resolution",
    docNoPrefix: "TRR",
    payloadVersion: 1,
    createSchema: TransferResolutionInputSchema,
    updateSchema: TransferResolutionInputSchema,
    payloadSchema: TransferResolutionPayloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);

      return {
        title: `Transfer resolution (${payload.resolutionType})`,
        searchText: [
          document.docNo,
          document.docType,
          payload.transferDocumentId,
          payload.resolutionType,
          payload.eventIdempotencyKey,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(context, input) {
      await resolveTransferDependencyDocument(context.db, input.transferDocumentId);
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(context, document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);
      await resolveTransferDependencyDocument(context.db, payload.transferDocumentId);
      await listPendingTransfers(context.db, payload.transferDocumentId);
    },
    async buildPostingPlan(context, document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);
      const transferDocument = await resolveTransferDependencyDocument(
        context.db,
        payload.transferDocumentId,
      );
      const pendingTransfers = await listPendingTransfers(
        context.db,
        payload.transferDocumentId,
      );
      const pending = pendingTransfers[payload.pendingIndex];

      if (!pending) {
        throw new DocumentValidationError(
          `Pending transfer index ${payload.pendingIndex} is out of range`,
        );
      }

      const transferPayload =
        transferDocument.docType === "transfer_intra"
          ? parseDocumentPayload(TransferIntraPayloadSchema, transferDocument)
          : parseDocumentPayload(TransferIntercompanyPayloadSchema, transferDocument);

      const bindings = await resolveTransferBindings(
        counterpartyAccountsService,
        transferPayload,
      );
      const bookId = resolvePendingTransferBookId({
        sourceBookId: bindings.source.bookId,
        destinationBookId: bindings.destination.bookId,
        pendingRef: pending.pendingRef,
      });

      const settle = payload.resolutionType === "settle";
      const templateKey = settle
        ? POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE
        : POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID;
      const operationCode = settle
        ? OPERATION_CODE.TRANSFER_SETTLE_PENDING
        : OPERATION_CODE.TRANSFER_VOID_PENDING;

      return buildDocumentPostingPlan({
        operationCode,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey,
            bookId,
            currency: transferPayload.currency,
            amountMinor: BigInt(transferPayload.amountMinor),
            dimensions: {},
            refs: {
              transferDocumentId: payload.transferDocumentId,
              eventIdempotencyKey: payload.eventIdempotencyKey,
              pendingIndex: String(payload.pendingIndex),
            },
            pending: {
              pendingId: pending.transferId,
              ref: pending.pendingRef,
              amountMinor: settle ? pending.amountMinor : 0n,
            },
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    resolveAccountingSourceId(_context, _document, postingPlan) {
      return postingPlan.operationCode === OPERATION_CODE.TRANSFER_SETTLE_PENDING
        ? ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_SETTLE
        : ACCOUNTING_SOURCE_ID.TRANSFER_RESOLUTION_VOID;
    },
    async buildInitialLinks(_context, document) {
      const payload = parseDocumentPayload(TransferResolutionPayloadSchema, document);
      return [
        {
          toDocumentId: payload.transferDocumentId,
          linkType: "depends_on",
        },
      ];
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}

function resolveFundingTemplateKey(kind: CapitalFundingInput["kind"]) {
  switch (kind) {
    case "founder_equity":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_FOUNDER_EQUITY;
    case "investor_equity":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_INVESTOR_EQUITY;
    case "shareholder_loan":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_SHAREHOLDER_LOAN;
    case "opening_balance":
      return POSTING_TEMPLATE_KEY.CAPITAL_FUNDING_OPENING_BALANCE;
    default:
      throw new DocumentValidationError(`Unsupported funding kind: ${kind}`);
  }
}

export function createCapitalFundingDocumentModule(deps: {
  counterpartyAccountsService: CounterpartyAccountsService;
}): DocumentModule<CapitalFundingInput, CapitalFundingInput> {
  const { counterpartyAccountsService } = deps;

  return {
    moduleId: "capital_funding",
    accountingSourceId: ACCOUNTING_SOURCE_ID.CAPITAL_FUNDING,
    docType: "capital_funding",
    docNoPrefix: "CAP",
    payloadVersion: 1,
    createSchema: CapitalFundingInputSchema,
    updateSchema: CapitalFundingInputSchema,
    payloadSchema: CapitalFundingPayloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft(_context, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    async updateDraft(_context, _document, input) {
      return buildDocumentDraft(input, {
        ...serializeOccurredAt(input),
        memo: input.memo,
      });
    },
    deriveSummary(document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);

      return {
        title: `Capital funding (${payload.kind})`,
        amountMinor: BigInt(payload.amountMinor),
        currency: payload.currency,
        memo: payload.memo ?? null,
        counterpartyId: payload.counterpartyId,
        counterpartyAccountId: payload.counterpartyAccountId,
        searchText: [
          document.docNo,
          document.docType,
          payload.kind,
          payload.entryRef,
          payload.counterpartyId,
          payload.counterpartyAccountId,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    async canCreate(_context, input) {
      const [binding] = await counterpartyAccountsService.resolveTransferBindings({
        accountIds: [input.counterpartyAccountId],
      });
      if (!binding) {
        throw new DocumentValidationError("Counterparty account binding is missing");
      }
      if (binding.counterpartyId !== input.counterpartyId) {
        throw new DocumentValidationError(
          "counterpartyId does not match counterpartyAccountId owner",
        );
      }
      if (binding.currencyCode !== input.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: payload=${input.currency}, account=${binding.currencyCode}`,
        );
      }
    },
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canCancel() {},
    async canPost(_context, document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);
      const [binding] = await counterpartyAccountsService.resolveTransferBindings({
        accountIds: [payload.counterpartyAccountId],
      });
      if (!binding) {
        throw new DocumentValidationError("Counterparty account binding is missing");
      }
      if (binding.counterpartyId !== payload.counterpartyId) {
        throw new DocumentValidationError(
          "counterpartyId does not match counterpartyAccountId owner",
        );
      }
      if (binding.currencyCode !== payload.currency) {
        throw new DocumentValidationError(
          `Currency mismatch: payload=${payload.currency}, account=${binding.currencyCode}`,
        );
      }
    },
    async buildPostingPlan(_context, document) {
      const payload = parseDocumentPayload(CapitalFundingPayloadSchema, document);
      const [binding] = await counterpartyAccountsService.resolveTransferBindings({
        accountIds: [payload.counterpartyAccountId],
      });

      if (!binding) {
        throw new DocumentValidationError("Counterparty account binding is missing");
      }

      return buildDocumentPostingPlan({
        operationCode: OPERATION_CODE.TREASURY_CAPITAL_FUNDING,
        payload: {
          ...payload,
          memo: payload.memo ?? null,
        },
        requests: [
          buildDocumentPostingRequest(document, {
            templateKey: resolveFundingTemplateKey(payload.kind),
            bookId: binding.bookId,
            currency: payload.currency,
            amountMinor: BigInt(payload.amountMinor),
            dimensions: {
              counterpartyId: payload.counterpartyId,
              counterpartyAccountId: payload.counterpartyAccountId,
            },
            refs: {
              entryRef: payload.entryRef,
              kind: payload.kind,
            },
            memo: payload.memo ?? null,
          }),
        ],
      });
    },
    buildPostIdempotencyKey(document) {
      return buildDocumentPostIdempotencyKey(document);
    },
  };
}

export function createIfrsDocumentModules(deps: {
  counterpartyAccountsService: CounterpartyAccountsService;
}): DocumentModule[] {
  return [
    createTransferIntraDocumentModule(deps),
    createTransferIntercompanyDocumentModule(deps),
    createTransferResolutionDocumentModule(deps),
    createCapitalFundingDocumentModule(deps),
    createSimpleIfrsDocumentModule({
      docType: "intercompany_loan_drawdown",
      docNoPrefix: "ILD",
      title: "Intercompany loan drawdown",
      createSchema: IntercompanyLoanDrawdownSchema,
      updateSchema: IntercompanyLoanDrawdownSchema,
      payloadSchema: IntercompanyLoanDrawdownSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "intercompany_loan_repayment",
      docNoPrefix: "ILR",
      title: "Intercompany loan repayment",
      createSchema: IntercompanyLoanRepaymentSchema,
      updateSchema: IntercompanyLoanRepaymentSchema,
      payloadSchema: IntercompanyLoanRepaymentSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "intercompany_interest_accrual",
      docNoPrefix: "IIA",
      title: "Intercompany interest accrual",
      createSchema: IntercompanyInterestAccrualSchema,
      updateSchema: IntercompanyInterestAccrualSchema,
      payloadSchema: IntercompanyInterestAccrualSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "intercompany_interest_settlement",
      docNoPrefix: "IIS",
      title: "Intercompany interest settlement",
      createSchema: IntercompanyInterestSettlementSchema,
      updateSchema: IntercompanyInterestSettlementSchema,
      payloadSchema: IntercompanyInterestSettlementSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "equity_contribution",
      docNoPrefix: "ECO",
      title: "Equity contribution",
      createSchema: EquityContributionSchema,
      updateSchema: EquityContributionSchema,
      payloadSchema: EquityContributionSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "equity_distribution",
      docNoPrefix: "EDI",
      title: "Equity distribution",
      createSchema: EquityDistributionSchema,
      updateSchema: EquityDistributionSchema,
      payloadSchema: EquityDistributionSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "accrual_adjustment",
      docNoPrefix: "AAC",
      title: "Accrual adjustment",
      createSchema: AccrualAdjustmentSchema,
      updateSchema: AccrualAdjustmentSchema,
      payloadSchema: AccrualAdjustmentSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "revaluation_adjustment",
      docNoPrefix: "ARV",
      title: "Revaluation adjustment",
      createSchema: RevaluationAdjustmentSchema,
      updateSchema: RevaluationAdjustmentSchema,
      payloadSchema: RevaluationAdjustmentSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "impairment_adjustment",
      docNoPrefix: "AIM",
      title: "Impairment adjustment",
      createSchema: ImpairmentAdjustmentSchema,
      updateSchema: ImpairmentAdjustmentSchema,
      payloadSchema: ImpairmentAdjustmentSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "closing_reclass",
      docNoPrefix: "ACR",
      title: "Closing reclass",
      createSchema: ClosingReclassSchema,
      updateSchema: ClosingReclassSchema,
      payloadSchema: ClosingReclassSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "period_close",
      docNoPrefix: "PCL",
      title: "Period close",
      createSchema: PeriodCloseSchema,
      updateSchema: PeriodCloseSchema,
      payloadSchema: PeriodCloseSchema,
    }),
    createSimpleIfrsDocumentModule({
      docType: "period_reopen",
      docNoPrefix: "PRN",
      title: "Period reopen",
      createSchema: PeriodReopenSchema,
      updateSchema: PeriodReopenSchema,
      payloadSchema: PeriodReopenSchema,
    }),
  ];
}
